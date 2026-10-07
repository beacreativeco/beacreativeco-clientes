// POST /api/trello/anexar  { midia_id, de_novo? }
// Anexa uma mídia no cartão do Trello do conteúdo (só a admin). Vai a versão do sistema,
// que é a que está no R2 (o original fica só no computador da Bea e no Drive).
// Trello grátis aceita anexo de até 10 MB: acima disso, anexa o link do arquivo no sistema.
// Grava em `midias` quando e como foi, para o editor mostrar "✓ No Trello".
import { responder, exigirAdmin, rest, UUID } from '../../_lib/servidor.js';
import { trello, trelloConfigurado } from '../../_lib/trello.js';
import { chaveDaUrl, tipoDaChave } from '../../_lib/midias.js';

const LIMITE_ANEXO = 10 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  const { resposta } = await exigirAdmin(request, env);
  if (resposta) return resposta;
  if (!trelloConfigurado(env)) return responder(500, 'O Trello não está configurado no servidor.');
  if (!env.MIDIAS) return responder(500, 'Armazenamento de arquivos não configurado.');

  const corpo = await request.json().catch(() => null);
  const midiaId = corpo?.midia_id;
  if (!midiaId || !UUID.test(midiaId)) return responder(400, 'Arquivo inválido.');

  const [midia] = (await rest(env,
    `midias?select=id,ordem,tipo,arquivo_url,trello_enviado_em,conteudos(titulo,trello_card_id)&id=eq.${midiaId}`)) ?? [];
  if (!midia) return responder(404, 'Arquivo não encontrado.');
  const cartao = midia.conteudos?.trello_card_id;
  if (!cartao) return responder(400, 'Este conteúdo não está ligado a um cartão do Trello.');
  if (midia.trello_enviado_em && !corpo.de_novo) return responder(409, 'Este arquivo já foi enviado pro Trello.');

  const chave = chaveDaUrl(midia.arquivo_url);
  const objeto = await env.MIDIAS.get(chave);
  if (!objeto) return responder(404, 'O arquivo não está mais no sistema (expirou). Envie o original pelo Drive.');

  const tipo = tipoDaChave(chave);
  const ext = chave.split('.').pop();
  const titulo = (midia.conteudos.titulo || 'Conteúdo').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80);
  const nome = `${titulo} - ${midia.tipo === 'video' ? 'vídeo' : 'imagem'} ${midia.ordem + 1}`;

  let anexo;
  let como;
  try {
    if (objeto.size <= LIMITE_ANEXO) {
      const form = new FormData();
      form.append('file', new Blob([await objeto.arrayBuffer()], { type: tipo?.mime }), `${nome}.${ext}`);
      form.append('name', `${nome}.${ext}`);
      if (tipo) form.append('mimeType', tipo.mime);
      anexo = await trello(env, `/cards/${cartao}/attachments`, { metodo: 'POST', corpo: form });
      como = 'arquivo';
    } else {
      const link = new URL(midia.arquivo_url, request.url).href;
      anexo = await trello(env, `/cards/${cartao}/attachments`, {
        metodo: 'POST', params: { url: link, name: `${nome} (no sistema de aprovação)` },
      });
      como = 'link';
    }
  } catch (err) {
    return responder(502, err.message);
  }

  const [atualizada] = await rest(env, `midias?id=eq.${midiaId}`, {
    metodo: 'PATCH',
    corpo: {
      trello_anexo_id: anexo.id,
      trello_anexo_url: anexo.url ?? null,
      trello_enviado_em: new Date().toISOString(),
      trello_como: como,
    },
  });
  return responder(200, null, { midia: atualizada, como });
}
