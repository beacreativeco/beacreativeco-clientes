// Excluir um cliente de vez (só a admin, com a chave de serviço).
//
// GET  /api/clientes/excluir?cliente_id=<uuid>
//   → resumo: { nome, pode, comuns: { conteudos, arquivos, mb }, vitrine: { conteudos, arquivos, mb } }
// POST /api/clientes/excluir  { cliente_id, nome, manter_vitrine }
//   → apaga os arquivos no R2 (todas as pastas), os conteúdos (conversas, mídias e notas vão
//     junto, em cascata), o login e o cadastro. Com manter_vitrine, os conteúdos da vitrine e
//     os arquivos deles ficam, e o cadastro fica arquivado (sem login nem contato).
//
// Regras: só com o acesso suspenso, ou de quem nunca teve login; e o nome digitado precisa
// bater com o do cadastro. O Trello não é tocado (os cartões são da Bea).
import { responder, exigirAdmin, rest, cabecalhosServidor, UUID } from '../../_lib/servidor.js';
import { PASTAS } from '../../_lib/midias.js';

async function carregar(env, clienteId) {
  const [cliente] = (await rest(env,
    `clientes?select=id,nome,user_id,login_ativo,arquivado_em&id=eq.${clienteId}`)) ?? [];
  if (!cliente || cliente.arquivado_em) return {};
  const conteudos = (await rest(env, `conteudos?select=id,status,na_vitrine&cliente_id=eq.${clienteId}`)) ?? [];
  const naVitrine = conteudos.filter((c) => c.status === 'aprovado' && c.na_vitrine);
  return { cliente, conteudos, naVitrine };
}

const podeExcluir = (cliente) => !cliente.user_id || cliente.login_ativo === false;

// Todas as chaves de um conteúdo, nas três pastas e nas antigas (sem pasta).
async function chavesDoConteudo(env, conteudoId) {
  const objetos = [];
  for (const prefixo of [...PASTAS.map((p) => `${p}/`), '']) {
    let cursor;
    do {
      const pagina = await env.MIDIAS.list({ prefix: `${prefixo}${conteudoId}/`, cursor });
      objetos.push(...pagina.objects);
      cursor = pagina.truncated ? pagina.cursor : undefined;
    } while (cursor);
  }
  return objetos;
}

const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 100) / 100;

export async function onRequestGet({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;
  const clienteId = new URL(request.url).searchParams.get('cliente_id');
  if (!clienteId || !UUID.test(clienteId)) return responder(400, 'Cliente inválido.');

  const { cliente, conteudos, naVitrine } = await carregar(env, clienteId);
  if (!cliente) return responder(404, 'Cliente não encontrado.');

  // Separado: os da vitrine dependem da escolha da Bea (manter ou apagar junto).
  const daVitrine = new Set(naVitrine.map((c) => c.id));
  const soma = { comuns: { conteudos: 0, arquivos: 0, bytes: 0 }, vitrine: { conteudos: 0, arquivos: 0, bytes: 0 } };
  for (const c of conteudos) {
    const grupo = soma[daVitrine.has(c.id) ? 'vitrine' : 'comuns'];
    grupo.conteudos++;
    for (const o of env.MIDIAS ? await chavesDoConteudo(env, c.id) : []) {
      grupo.arquivos++;
      grupo.bytes += o.size;
    }
  }
  const pronto = ({ bytes, ...resto }) => ({ ...resto, mb: mb(bytes) });
  return responder(200, null, {
    nome: cliente.nome,
    pode: podeExcluir(cliente),
    comuns: pronto(soma.comuns),
    vitrine: pronto(soma.vitrine),
  });
}

export async function onRequestPost({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');

  const corpo = await request.json().catch(() => null);
  const clienteId = corpo?.cliente_id;
  if (!clienteId || !UUID.test(clienteId)) return responder(400, 'Cliente inválido.');

  const { cliente, conteudos, naVitrine } = await carregar(env, clienteId);
  if (!cliente) return responder(404, 'Cliente não encontrado.');
  if (!podeExcluir(cliente)) return responder(409, 'Suspenda o acesso do cliente antes de excluir.');
  const normalizar = (t) => String(t ?? '').trim().toLocaleLowerCase('pt-BR');
  if (normalizar(corpo.nome) !== normalizar(cliente.nome)) {
    return responder(400, 'O nome digitado não confere com o do cliente.');
  }
  if (naVitrine.length && typeof corpo.manter_vitrine !== 'boolean') {
    return responder(400, 'Escolha se os conteúdos da vitrine ficam ou são apagados.');
  }
  const manter = naVitrine.length > 0 && corpo.manter_vitrine === true;
  const ficam = new Set(manter ? naVitrine.map((c) => c.id) : []);
  const apagar = conteudos.filter((c) => !ficam.has(c.id));

  // 1. Arquivos no R2 (antes do banco: se algo falhar no meio, dá para rodar de novo).
  let arquivos = 0;
  let bytes = 0;
  for (const c of apagar) {
    const objetos = await chavesDoConteudo(env, c.id);
    for (let i = 0; i < objetos.length; i += 1000) {
      const lote = objetos.slice(i, i + 1000);
      await env.MIDIAS.delete(lote.map((o) => o.key));
    }
    arquivos += objetos.length;
    bytes += objetos.reduce((soma, o) => soma + o.size, 0);
  }

  // 2. Conteúdos (mídias, mensagens, notas internas e avisos vão junto, em cascata).
  for (let i = 0; i < apagar.length; i += 100) {
    const ids = apagar.slice(i, i + 100).map((c) => c.id).join(',');
    await rest(env, `conteudos?id=in.(${ids})`, { metodo: 'DELETE', retornar: false });
  }

  // 3. Login.
  if (cliente.user_id) {
    const resp = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${cliente.user_id}`, {
      method: 'DELETE', headers: cabecalhosServidor(env),
    });
    if (!resp.ok && resp.status !== 404) {
      console.error('excluir login', resp.status, await resp.text());
      return responder(502, 'Os conteúdos foram apagados, mas o login não. Tente excluir de novo.');
    }
  }

  // 4. Cadastro: apagado de vez, ou arquivado só para a vitrine.
  if (manter) {
    await rest(env, `clientes?id=eq.${clienteId}`, {
      metodo: 'PATCH', retornar: false,
      corpo: {
        arquivado_em: new Date().toISOString(), user_id: null, login_ativo: false,
        email: null, whatsapp: null, drive_pasta_url: null, trello_board_id: null,
      },
    });
  } else {
    await rest(env, `clientes?id=eq.${clienteId}`, { metodo: 'DELETE', retornar: false });
  }

  return responder(200, null, {
    nome: cliente.nome,
    conteudos: apagar.length,
    vitrine: ficam.size,
    arquivos,
    mb: mb(bytes),
    arquivado: manter,
  });
}
