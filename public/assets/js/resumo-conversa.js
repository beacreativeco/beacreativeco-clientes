// No lugar da conversa, na tela do conteúdo (editor da Bea e página do cliente): o último
// pedido de ajuste, se houver, e "Conversar sobre este conteúdo (N)", que abre a aba
// Mensagens filtrada nele. Atualiza na hora (tempo real) quando chega mensagem dele.
import { supabase } from './supabase.js';
import { diaSemanaHora } from './conteudos.js';

function el(tag, classe, ...filhos) {
  const n = document.createElement(tag);
  if (classe) n.className = classe;
  for (const f of filhos.flat()) if (f != null && f !== false) n.append(f);
  return n;
}

/**
 * @param {HTMLElement} alvo
 * @param {{
 *   conteudoId: string,
 *   eu: 'bea' | 'cliente',
 *   link: string,                        // conversa filtrada neste conteúdo
 *   nomeDoOutro?: string,                // quem pediu o ajuste, visto pela Bea
 *   aoMudarSituacao?: (m: object) => void, // chegou aprovação ou pedido de ajuste
 * }} opcoes
 */
export function montarResumoDaConversa(alvo, { conteudoId, eu, link, nomeDoOutro, aoMudarSituacao }) {
  async function desenhar() {
    const [total, pedido] = await Promise.all([
      supabase.from('mensagens').select('id', { count: 'exact', head: true })
        .eq('conteudo_id', conteudoId).is('apagada_em', null),
      supabase.from('mensagens').select('autor, tipo, texto, criado_em')
        .eq('conteudo_id', conteudoId).eq('pedido_ajuste', true).is('apagada_em', null)
        .order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (total.error) console.error(total.error);
    if (pedido.error) console.error(pedido.error);

    const n = total.count ?? 0;
    const botao = el('a', 'botao-secundario resumo-conversa-botao',
      n ? `Conversar sobre este conteúdo (${n})` : 'Conversar sobre este conteúdo');
    botao.href = link;

    const p = pedido.data;
    let bloco = null;
    if (p) {
      const corpo = p.texto
        ? el('q', 'resumo-ajuste-texto', p.texto)
        : el('p', 'resumo-ajuste-texto', p.tipo === 'audio' ? 'Pedido em áudio. Ouça na conversa.' : 'Pedido com imagem. Veja na conversa.');
      const quem = p.autor === eu ? 'Você' : (nomeDoOutro || 'Cliente');
      bloco = el('div', 'resumo-ajuste',
        el('span', 'resumo-ajuste-rotulo', `Último pedido de ajuste · ${diaSemanaHora(p.criado_em)}`),
        corpo,
        el('span', 'resumo-ajuste-quem', quem));
    }
    alvo.replaceChildren(...[bloco, botao].filter(Boolean));
  }

  const canal = supabase.channel(`resumo-${conteudoId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'mensagens', filter: `conteudo_id=eq.${conteudoId}` },
      ({ eventType, new: m }) => {
        desenhar().catch(console.error);
        if (eventType === 'INSERT' && (m.tipo === 'aprovacao' || m.pedido_ajuste)) aoMudarSituacao?.(m);
      })
    .subscribe();
  window.addEventListener('pagehide', () => supabase.removeChannel(canal));

  return { carregar: desenhar };
}
