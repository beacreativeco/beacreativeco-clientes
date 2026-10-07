import { supabase, chamarServidor } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar, montarTrilha } from './ui.js';
import { FORMATOS, SITUACOES, diaEMes, parametro, marcarNaoLidas } from './conteudos.js';

const clienteId = parametro('id');

iniciarPagina('admin', async () => {
  document.getElementById('sair').addEventListener('click', sair);
  if (!clienteId) {
    window.location.replace('/admin/');
    return;
  }

  const [cliente, conteudos] = await Promise.all([
    supabase.from('clientes').select('id, nome, instagram, email, user_id, login_ativo, arquivado_em').eq('id', clienteId).maybeSingle(),
    supabase
      .from('conteudos')
      .select('id, titulo, formato, data_prevista, status')
      .eq('cliente_id', clienteId)
      .order('data_prevista', { ascending: true, nullsFirst: false })
      .order('criado_em', { ascending: true }),
  ]);
  if (cliente.error) throw cliente.error;
  if (conteudos.error) throw conteudos.error;
  if (!cliente.data || cliente.data.arquivado_em) {
    window.location.replace('/admin/');
    return;
  }

  const c = cliente.data;
  document.title = `${c.nome} · BeaCreative`;
  document.getElementById('nome-cliente').textContent = c.nome;
  montarTrilha([{ texto: 'Clientes', href: '/admin/' }, { texto: c.nome }]);
  document.getElementById('contato-cliente').textContent = c.instagram ? '@' + c.instagram : (c.email ?? '');
  document.getElementById('novo-conteudo').href = `/admin/conteudo/?cliente=${c.id}`;

  desenharAgenda(conteudos.data);
  ligarExclusao(c);
  // avisos-admin.js conta as não lidas (e reconta a cada mensagem nova).
  window.addEventListener('mensagens-mudaram', (e) =>
    marcarNaoLidas(document.getElementById('agenda'), e.detail));
});

function desenharAgenda(conteudos) {
  const agenda = document.getElementById('agenda');
  const modelo = document.getElementById('modelo-conteudo');
  document.getElementById('agenda-vazia').hidden = conteudos.length > 0;
  agenda.hidden = conteudos.length === 0;

  agenda.replaceChildren(...conteudos.map((item) => {
    const li = modelo.content.firstElementChild.cloneNode(true);
    li.dataset.id = item.id;
    const data = diaEMes(item.data_prevista);
    const situacao = SITUACOES[item.status];

    li.querySelector('.agenda-link').href = `/admin/conteudo/?id=${item.id}`;
    li.querySelector('.agenda-dia').textContent = data ? data.dia : '–';
    li.querySelector('.agenda-mes').textContent = data ? data.mes : 'sem data';
    li.querySelector('.agenda-titulo').textContent = item.titulo;
    li.querySelector('.agenda-formato').textContent = FORMATOS[item.formato];
    const selo = li.querySelector('.situacao');
    selo.textContent = situacao.texto;
    selo.classList.add(situacao.classe);
    return li;
  }));
}

// ---------------------------------------------------------------- excluir

// Só com o acesso suspenso (ou de quem nunca teve login), para não excluir alguém ativo sem querer.
function ligarExclusao(c) {
  const zona = document.getElementById('zona-excluir');
  const pode = !c.user_id || c.login_ativo === false;
  zona.hidden = false;
  document.getElementById('zona-excluir-texto').textContent = pode
    ? 'Apaga de vez o login, os conteúdos, as conversas e os arquivos deste cliente, liberando o espaço.'
    : 'Para excluir, primeiro suspenda o acesso do cliente na página Clientes.';
  const abrir = document.getElementById('abrir-excluir');
  abrir.hidden = !pode;
  if (!pode) return;

  const dialogo = document.getElementById('dialogo-excluir');
  const form = document.getElementById('form-excluir');
  const campo = document.getElementById('excluir-nome');
  const confirmar = document.getElementById('confirmar-excluir');
  const erro = document.getElementById('excluir-erro');
  const vitrine = document.getElementById('excluir-vitrine');
  let resumo = null;

  const normalizar = (t) => t.trim().toLocaleLowerCase('pt-BR');
  const pronto = () => Boolean(resumo)
    && normalizar(campo.value) === normalizar(c.nome)
    && (!resumo.vitrine.conteudos || Boolean(form.vitrine.value));
  const atualizarBotao = () => { confirmar.disabled = !pronto(); };

  dialogo.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => dialogo.close()));
  campo.addEventListener('input', atualizarBotao);
  vitrine.addEventListener('change', atualizarBotao);

  abrir.addEventListener('click', async () => {
    form.reset();
    erro.hidden = true;
    resumo = null;
    atualizarBotao();
    document.getElementById('excluir-nome-esperado').textContent = c.nome;
    const lista = document.getElementById('excluir-resumo');
    lista.replaceChildren(item('Calculando…'));
    vitrine.hidden = true;
    dialogo.showModal();
    try {
      resumo = await chamarServidor(`/api/clientes/excluir?cliente_id=${c.id}`);
      const n = (q, um, varios) => `${q} ${q === 1 ? um : varios}`;
      const { comuns, vitrine: daVitrine } = resumo;
      lista.replaceChildren(
        c.user_id ? item(`o login de ${c.nome}`) : '',
        item(n(comuns.conteudos, 'conteúdo', 'conteúdos') + ', com conversas, áudios e imagens'),
        item(`${n(comuns.arquivos, 'arquivo', 'arquivos')} no armazenamento (${formatarMb(comuns.mb)} liberados)`),
      );
      if (daVitrine.conteudos) {
        document.getElementById('excluir-vitrine-titulo').textContent =
          `${n(daVitrine.conteudos, 'conteúdo está', 'conteúdos estão')} na vitrine do site `
          + `(${n(daVitrine.arquivos, 'arquivo', 'arquivos')}, ${formatarMb(daVitrine.mb)}). O que fazer?`;
        vitrine.hidden = false;
      }
      atualizarBotao();
      campo.focus();
    } catch (err) {
      mostrarErro(err.message);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pronto()) return;
    confirmar.disabled = true;
    confirmar.textContent = 'Excluindo…';
    erro.hidden = true;
    try {
      const feito = await chamarServidor('/api/clientes/excluir', {
        metodo: 'POST',
        corpo: { cliente_id: c.id, nome: campo.value, ...(resumo.vitrine.conteudos && { manter_vitrine: form.vitrine.value === 'manter' }) },
      });
      // O aviso aparece na página Clientes, para onde a Bea volta.
      try {
        sessionStorage.setItem('aviso-clientes', feito.arquivado
          ? `${feito.nome} foi excluído. Os conteúdos da vitrine continuam lá.`
          : `${feito.nome} foi excluído e liberou ${formatarMb(feito.mb)} no armazenamento.`);
      } catch { /* sem sessionStorage: só não mostra o aviso */ }
      window.location.replace('/admin/');
    } catch (err) {
      mostrarErro(err.message);
      confirmar.textContent = 'Excluir de vez';
      atualizarBotao();
    }
  });

  function mostrarErro(texto) {
    erro.textContent = texto;
    erro.hidden = false;
  }
}

function item(texto) {
  const li = document.createElement('li');
  li.textContent = texto;
  return li;
}

function formatarMb(mb) {
  if (mb < 0.1) return 'menos de 0,1 MB';
  return mb >= 1024 ? `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
    : `${mb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}
