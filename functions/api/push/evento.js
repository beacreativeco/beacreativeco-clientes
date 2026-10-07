// POST /api/push/evento   { tipo: 'mensagem' | 'conteudo_liberado', id } ou { tipo: 'prazos' }
// Chamado pelo próprio banco (gatilhos com pg_net, migração 20261021000000; 'prazos' pelo
// pg_cron todo dia às 9h de Brasília, migração 20261022000000), com o segredo no cabeçalho
// X-Push-Segredo. Relê no banco, decide quem avisar e manda o push.
//
// Cada evento é reservado em push_eventos antes de enviar: o banco chama a produção e o
// Preview, e só o primeiro envia. Fora da produção, só clientes de teste (PUSH_SO_CLIENTES,
// ids separados por vírgula): cliente de verdade só recebe aviso pela produção.
import { responder, rest, UUID } from '../../_lib/servidor.js';
import { ehProducao } from '../../_lib/ambiente.js';
import { avisarUsuario } from '../../_lib/webpush.js';

const PREVIA = 120;

function mesmoSegredo(a, b) {
  const x = new TextEncoder().encode(a ?? '');
  const y = new TextEncoder().encode(b ?? '');
  if (!x.length || x.length !== y.length) return false;
  return crypto.subtle.timingSafeEqual(x, y);
}

const cortar = (t) => (t.length > PREVIA ? `${t.slice(0, PREVIA - 1).trimEnd()}…` : t);

// O que a mensagem diz, em uma linha (áudio e imagem viram um rótulo).
function previa(m) {
  if (m.tipo === 'audio') return '🎤 Áudio';
  if (m.tipo === 'referencia') return m.texto ? `📷 ${cortar(m.texto)}` : '📷 Imagem';
  return cortar((m.texto ?? '').replace(/\s+/g, ' ').trim());
}

// Reserva o evento; false se outro destino (ou uma chamada repetida) já enviou.
async function reservar(env, chave) {
  const criadas = await rest(env, 'push_eventos', {
    metodo: 'POST', corpo: { chave }, prefer: 'resolution=ignore-duplicates',
  });
  return Boolean(criadas?.length);
}

async function idsDaBea(env) {
  return ((await rest(env, 'admins?select=user_id')) ?? []).map((a) => a.user_id);
}

async function mensagem(env, id, podeCliente) {
  const [m] = (await rest(env,
    `mensagens?select=id,cliente_id,conteudo_id,autor,tipo,texto,pedido_ajuste,so_bea,apagada_em&id=eq.${id}`)) ?? [];
  if (!m || m.so_bea || m.apagada_em || !podeCliente(m.cliente_id)) return 0;

  const [[cliente], conteudo] = await Promise.all([
    rest(env, `clientes?select=id,nome,user_id,login_ativo&id=eq.${m.cliente_id}`).then((r) => r ?? []),
    m.conteudo_id ? rest(env, `conteudos?select=id,titulo&id=eq.${m.conteudo_id}`).then((r) => r?.[0]) : null,
  ]);
  if (!cliente || !(await reservar(env, `mensagem:${m.id}`))) return 0;
  const titulo = conteudo?.titulo ? `“${conteudo.titulo}”` : 'um conteúdo';

  if (m.autor === 'cliente') {
    // Para a Bea: o título é o nome do cliente.
    let aviso;
    if (m.tipo === 'aprovacao') {
      aviso = { corpo: `✦ Aprovou ${titulo}`, url: `/admin/conteudo/?id=${m.conteudo_id}`, tag: `conteudo-${m.conteudo_id}` };
    } else if (m.pedido_ajuste) {
      aviso = { corpo: `Pediu ajuste em ${titulo}: ${previa(m)}`, url: `/admin/mensagens/?cliente=${cliente.id}`, tag: `conversa-${cliente.id}` };
    } else {
      aviso = { corpo: previa(m), url: `/admin/mensagens/?cliente=${cliente.id}`, tag: `conversa-${cliente.id}` };
    }
    const enviados = await Promise.all((await idsDaBea(env)).map((u) => avisarUsuario(env, u, { titulo: cliente.nome, ...aviso })));
    return enviados.reduce((a, b) => a + b, 0);
  }

  // Para o cliente (com login ativo): o título é "BeaCreative".
  if (!cliente.user_id || !cliente.login_ativo) return 0;
  return avisarUsuario(env, cliente.user_id, {
    titulo: 'BeaCreative', corpo: previa(m), url: '/cliente/mensagens/', tag: 'conversa',
  });
}

async function conteudoLiberado(env, id, podeCliente) {
  const [c] = (await rest(env, `conteudos?select=id,titulo,status,versao_atual,cliente_id&id=eq.${id}`)) ?? [];
  if (!c || c.status !== 'em_aprovacao' || !podeCliente(c.cliente_id)) return 0;
  const [cliente] = (await rest(env, `clientes?select=user_id,login_ativo&id=eq.${c.cliente_id}`)) ?? [];
  if (!cliente?.user_id || !cliente.login_ativo) return 0;
  if (!(await reservar(env, `liberado:${c.id}:${c.versao_atual}`))) return 0;
  return avisarUsuario(env, cliente.user_id, {
    titulo: 'BeaCreative',
    corpo: c.versao_atual > 1 ? `Nova versão para aprovar: “${c.titulo}”` : `Conteúdo novo para aprovar: “${c.titulo}”`,
    url: `/cliente/conteudo/?id=${c.id}`,
    tag: `conteudo-${c.id}`,
  });
}

// Brasília é UTC−3 o ano todo (sem horário de verão desde 2019).
const BRASILIA_MS = 3 * 60 * 60 * 1000;

// Prazo de aprovação vencendo amanhã (de 0h a 24h de amanhã, horário de Brasília), para o
// cliente que ainda não decidiu. Um aviso por conteúdo e prazo (mudou o prazo: avisa de novo).
async function prazos(env, podeCliente) {
  const hoje = new Date(Date.now() - BRASILIA_MS);
  const inicio = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + 1) + BRASILIA_MS);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  const lista = (await rest(env, 'conteudos?select=id,titulo,cliente_id,prazo_aprovacao'
    + `&status=eq.em_aprovacao&prazo_aprovacao=gte.${inicio.toISOString()}&prazo_aprovacao=lt.${fim.toISOString()}`)) ?? [];

  let enviados = 0;
  for (const c of lista.filter((x) => podeCliente(x.cliente_id))) {
    const [cliente] = (await rest(env, `clientes?select=user_id,login_ativo&id=eq.${c.cliente_id}`)) ?? [];
    if (!cliente?.user_id || !cliente.login_ativo) continue;
    if (!(await reservar(env, `prazo:${c.id}:${c.prazo_aprovacao}`))) continue;
    const hora = new Date(c.prazo_aprovacao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    enviados += await avisarUsuario(env, cliente.user_id, {
      titulo: 'BeaCreative',
      corpo: `O prazo para aprovar “${c.titulo}” vence amanhã às ${hora}.`,
      url: `/cliente/conteudo/?id=${c.id}`,
      tag: `conteudo-${c.id}`,
    });
  }
  return enviados;
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.PUSH_SEGREDO || !env.VAPID_PRIVATE_KEY) return responder(500, 'Notificações não configuradas no servidor.');
  if (!mesmoSegredo(request.headers.get('X-Push-Segredo'), env.PUSH_SEGREDO)) return responder(401, 'Segredo inválido.');

  const { tipo, id } = (await request.json().catch(() => null)) ?? {};
  if (tipo !== 'prazos' && !UUID.test(id ?? '')) return responder(400, 'Evento inválido.');

  const testes = new Set((env.PUSH_SO_CLIENTES ?? '').split(',').map((s) => s.trim()).filter(Boolean));
  const podeCliente = ehProducao(request) ? () => true : (clienteId) => testes.has(clienteId);

  const tarefa = {
    mensagem: () => mensagem(env, id, podeCliente),
    conteudo_liberado: () => conteudoLiberado(env, id, podeCliente),
    prazos: () => prazos(env, podeCliente),
  }[tipo];
  if (!tarefa) return responder(400, 'Evento desconhecido.');

  // Responde logo ao banco; o envio continua depois da resposta.
  waitUntil(tarefa().catch((err) => console.error('push evento', tipo, id, err)));
  return responder(202, null, { ok: true });
}
