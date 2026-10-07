import { supabase, chamarServidor } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar } from './ui.js';
import { SITUACOES, LIMITE_LEGENDA, dataHora, parametro, problemaDasMidias } from './conteudos.js';
import {
  iniciarMidias, carregarMidias, definirFormato, definirDrive, midiasAtuais, enviandoArquivos, excluirTodas,
} from './editor-midias.js';
import { criarPrevia } from './previa-instagram.js';
import { criarConversa } from './conversa.js';
import { limparArquivosDaConversa } from './upload.js';

const form = document.getElementById('form-conteudo');
const aviso = document.getElementById('aviso');
const botoes = {
  salvar: document.getElementById('salvar'),
  enviar: document.getElementById('enviar'),
  retirar: document.getElementById('retirar'),
  excluir: document.getElementById('excluir'),
};

let conteudo = null;      // linha de `conteudos` (null enquanto é novo)
let cliente = null;       // { id, nome, prazo_padrao_dias, instagram, foto_perfil, contato_nome, contato_foto_url }
let temNotaInterna = false;

iniciarPagina('admin', async () => {
  document.getElementById('sair').addEventListener('click', sair);
  form.addEventListener('submit', (e) => { e.preventDefault(); executar(botoes.salvar, salvar); });
  botoes.enviar.addEventListener('click', () => executar(botoes.enviar, enviarParaAprovacao));
  botoes.retirar.addEventListener('click', () => executar(botoes.retirar, voltarParaRascunho));
  botoes.excluir.addEventListener('click', excluirRascunho);
  form.legenda.addEventListener('input', () => { atualizarContador(); atualizarPrevia(); });
  form.data_prevista.addEventListener('change', () => atualizarPrevia());
  form.querySelectorAll('input[name="formato"]').forEach((r) =>
    r.addEventListener('change', () => definirFormato(form.formato.value)));
  form.drive_url.addEventListener('input', () => definirDrive(form.drive_url.value.trim()));
  iniciarMidias({
    // Arquivo precisa de um conteúdo salvo: cria o rascunho na hora, se for novo.
    garantirConteudo: async () => {
      if (!conteudo) await salvar({ silencioso: true });
      return conteudo.id;
    },
    aoErro: mostrarErro,
    aoMudar: () => atualizarPrevia(),
  });

  const id = parametro('id');
  const clienteId = parametro('cliente');
  if (id) await carregarConteudo(id);
  else if (clienteId) await carregarCliente(clienteId);
  if (!cliente) {
    window.location.replace('/admin/');
    return;
  }
  desenhar();
  if (conteudo) await abrirConversa();
});

// ---------------------------------------------------------------- carregar

async function carregarCliente(id) {
  const { data, error } = await supabase
    .from('clientes').select('id, nome, prazo_padrao_dias, instagram, foto_perfil, contato_nome, contato_foto_url').eq('id', id).maybeSingle();
  if (error) throw error;
  cliente = data;
}

async function carregarConteudo(id) {
  const { data, error } = await supabase.from('conteudos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return;
  conteudo = data;

  const [nota] = await Promise.all([
    supabase.from('conteudos_internos')
      .select('observacao_interna, trello_url, trello_etiquetas, trello_aviso').eq('conteudo_id', id).maybeSingle(),
    carregarMidias(data),
    carregarCliente(data.cliente_id),
  ]);
  if (nota.error) throw nota.error;
  temNotaInterna = Boolean(nota.data?.observacao_interna);
  form.observacao_interna.value = nota.data?.observacao_interna ?? '';
  mostrarTrello(nota.data);
}

// Já postado (etiqueta POSTADO no Trello, de antes do sistema): fica só como registro no
// calendário, sem envio ao cliente.
let postadoNoTrello = false;

// "Trello: Gravado · Abrir no Trello", e o aviso da sincronização quando houver.
function mostrarTrello(internos) {
  postadoNoTrello = Boolean(internos?.trello_etiquetas?.includes('POSTADO'));
  const info = document.getElementById('trello-info');
  const etapa = internos?.trello_etiquetas?.at(-1);
  const partes = [];
  if (etapa) partes.push(`Trello: ${etapa.charAt(0)}${etapa.slice(1).toLowerCase()}`);
  if (internos?.trello_url) {
    const link = document.createElement('a');
    link.href = internos.trello_url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Abrir no Trello';
    partes.push(link);
  }
  info.replaceChildren(...partes.flatMap((p, i) => (i ? [' · ', p] : [p])));
  if (internos?.trello_aviso) {
    const aviso = document.createElement('span');
    aviso.className = 'editor-trello-aviso';
    aviso.textContent = internos.trello_aviso;
    info.append(aviso);
  }
  info.hidden = !info.childNodes.length;
}

// Conversa com o cliente (mesmo componente da página dele). Se o cliente aprovar ou pedir
// ajuste com o editor aberto, a situação atualiza sozinha.
async function abrirConversa() {
  document.getElementById('secao-conversa').hidden = false;
  const conversa = criarConversa(document.getElementById('conversa'), {
    conteudoId: conteudo.id,
    eu: 'bea',
    // Nome e foto de quem aprova (Meu perfil do cliente); sem nome, o do cadastro.
    perfilDoOutro: { nome: cliente.contato_nome || cliente.nome, foto_url: cliente.contato_foto_url },
    aoChegar: async (m) => {
      if (m.tipo !== 'aprovacao' && !m.pedido_ajuste) return;
      const { data, error } = await supabase.from('conteudos').select('*').eq('id', conteudo.id).single();
      if (error) return console.error(error);
      conteudo = data;
      atualizarSituacao();
      avisar(m.tipo === 'aprovacao' ? 'O cliente aprovou este conteúdo.' : 'O cliente pediu ajuste.');
    },
  });
  await conversa.carregar();
  // Veio da Caixa de mensagens ou de um aviso: vai direto para a conversa.
  if (location.hash === '#conversa') {
    document.getElementById('secao-conversa').scrollIntoView({ block: 'start' });
  }
}

// ---------------------------------------------------------------- tela

function desenhar() {
  const voltar = document.getElementById('voltar');
  voltar.href = `/admin/cliente/?id=${cliente.id}`;
  voltar.textContent = `Conteúdos de ${cliente.nome}`;

  if (conteudo) {
    document.title = `${conteudo.titulo} · BeaCreative`;
    document.getElementById('titulo-pagina').textContent = conteudo.titulo;
    form.formato.value = conteudo.formato;
    form.titulo.value = conteudo.titulo;
    form.data_prevista.value = conteudo.data_prevista ?? '';
    form.drive_url.value = conteudo.drive_url ?? '';
    form.legenda.value = conteudo.legenda ?? '';
  } else {
    document.title = `Novo conteúdo · ${cliente.nome}`;
  }

  definirFormato(form.formato.value);
  definirDrive(form.drive_url.value.trim());
  atualizarContador();
  atualizarSituacao();
  atualizarPrevia();
}

// ---------------------------------------------------------------- prévia

let previa;
function atualizarPrevia() {
  if (!cliente) return; // a lista de mídias pode avisar antes do cliente carregar
  previa ??= criarPrevia(document.getElementById('previa'), { guias: true });
  previa.atualizar({
    formato: form.formato.value,
    midias: midiasAtuais(),
    legenda: form.legenda.value,
    data: form.data_prevista.value || null,
    cliente,
    drive: form.drive_url.value.trim(),
  });
}

function atualizarSituacao() {
  const status = conteudo?.status;
  const situacao = document.getElementById('situacao-atual');
  const prazo = document.getElementById('prazo-info');

  situacao.className = 'situacao';
  situacao.hidden = !status;
  if (status) {
    situacao.textContent = SITUACOES[status].texto;
    situacao.classList.add(SITUACOES[status].classe);
  }

  botoes.salvar.textContent = conteudo ? 'Salvar alterações' : 'Criar rascunho';
  botoes.enviar.hidden = !['rascunho', 'ajuste_solicitado'].includes(status) || (postadoNoTrello && status === 'rascunho');
  botoes.enviar.textContent = status === 'ajuste_solicitado' ? 'Reenviar para aprovação' : 'Enviar para aprovação';
  botoes.retirar.hidden = status !== 'em_aprovacao';
  botoes.excluir.hidden = status !== 'rascunho';

  prazo.hidden = true;
  if (status === 'em_aprovacao' && conteudo.prazo_aprovacao) {
    prazo.textContent = `O cliente tem até ${dataHora(conteudo.prazo_aprovacao)} para aprovar. Alterações salvas aparecem para ele na hora.`;
    prazo.hidden = false;
  }
  if (postadoNoTrello && status === 'rascunho') {
    prazo.textContent = 'Já está como postado no Trello: fica no calendário como registro e não vai para o cliente.';
    prazo.hidden = false;
  }
  if (status === 'aprovado') {
    const quem = conteudo.aprovado_por === 'prazo' ? 'pelo prazo' : 'pelo cliente';
    prazo.textContent = `Aprovado ${quem} em ${dataHora(conteudo.aprovado_em)}.`;
    prazo.hidden = false;
  }
}

function atualizarContador() {
  const total = form.legenda.value.length;
  const contador = document.getElementById('contador-legenda');
  contador.textContent = `${total.toLocaleString('pt-BR')} de ${LIMITE_LEGENDA.toLocaleString('pt-BR')}`;
  contador.classList.toggle('passou', total > LIMITE_LEGENDA);
}

function mostrarErro(texto) {
  aviso.textContent = texto;
  aviso.hidden = false;
  aviso.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Desabilita o botão enquanto a ação roda e mostra erros de forma uniforme.
async function executar(botao, acao) {
  aviso.hidden = true;
  botao.disabled = true;
  try {
    await acao();
  } catch (err) {
    console.error(err);
    mostrarErro(err.message || 'Algo deu errado. Tente de novo.');
  } finally {
    botao.disabled = false;
  }
}

// ---------------------------------------------------------------- ações

function lerFormulario() {
  const texto = (campo) => form[campo].value.trim() || null;
  return {
    formato: form.formato.value,
    titulo: texto('titulo'),
    data_prevista: texto('data_prevista'),
    drive_url: texto('drive_url'),
    legenda: form.legenda.value.trim() || null,
  };
}

function validar(dados) {
  if (!dados.titulo) return 'Dê um título para o conteúdo.';
  if (dados.drive_url && !/^https:\/\//.test(dados.drive_url)) return 'O link do Drive precisa começar com https://';
  if ((dados.legenda?.length ?? 0) > LIMITE_LEGENDA) return `A legenda passou do limite do Instagram (${LIMITE_LEGENDA.toLocaleString('pt-BR')} caracteres).`;
  return null;
}

async function salvar({ silencioso = false } = {}) {
  const dados = lerFormulario();
  const problema = validar(dados);
  if (problema) throw new Error(problema);

  const consulta = conteudo
    ? supabase.from('conteudos').update(dados).eq('id', conteudo.id)
    : supabase.from('conteudos').insert({ ...dados, cliente_id: cliente.id });
  const { data, error } = await consulta.select().single();
  if (error) throw new Error('Não foi possível salvar o conteúdo.');
  const eraNovo = !conteudo;
  conteudo = data;

  await salvarNotaInterna();

  if (eraNovo) history.replaceState(null, '', `/admin/conteudo/?id=${conteudo.id}`);
  document.title = `${conteudo.titulo} · BeaCreative`;
  document.getElementById('titulo-pagina').textContent = conteudo.titulo;
  atualizarSituacao();
  if (!silencioso) avisar(eraNovo ? 'Rascunho criado.' : 'Alterações salvas.');
}

async function salvarNotaInterna() {
  const texto = form.observacao_interna.value.trim();
  if (texto) {
    const { error } = await supabase.from('conteudos_internos')
      .upsert({ conteudo_id: conteudo.id, observacao_interna: texto });
    if (error) throw new Error('O conteúdo foi salvo, mas a observação interna não.');
    temNotaInterna = true;
  } else if (temNotaInterna) {
    // Só limpa a observação: a mesma linha guarda o vínculo com o Trello.
    const { error } = await supabase.from('conteudos_internos')
      .update({ observacao_interna: null }).eq('conteudo_id', conteudo.id);
    if (error) throw new Error('O conteúdo foi salvo, mas a observação interna não foi apagada.');
    temNotaInterna = false;
  }
}

async function enviarParaAprovacao() {
  if (enviandoArquivos()) throw new Error('Espere os arquivos terminarem de subir.');
  await salvar({ silencioso: true });
  const problema = problemaDasMidias(conteudo.formato, midiasAtuais());
  if (problema) throw new Error(problema);

  const dias = cliente.prazo_padrao_dias ?? 2;
  const prazo = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('conteudos')
    .update({ status: 'em_aprovacao', prazo_aprovacao: prazo })
    .eq('id', conteudo.id).select().single();
  if (error) throw new Error('Não foi possível enviar para aprovação.');
  conteudo = data;
  atualizarSituacao();
  avisar('Enviado para aprovação.');
  organizarDepois(conteudo.id);
}

async function voltarParaRascunho() {
  const { data, error } = await supabase.from('conteudos')
    .update({ status: 'rascunho', prazo_aprovacao: null })
    .eq('id', conteudo.id).select().single();
  if (error) throw new Error('Não foi possível voltar para rascunho.');
  conteudo = data;
  atualizarSituacao();
  avisar('Voltou para rascunho. O cliente não vê mais este conteúdo.');
  organizarDepois(conteudo.id);
}

// Depois de mudar a situação, o servidor acerta o que fica fora do banco: a pasta dos arquivos
// no armazenamento (ex.: aprovados/, apagados 30 dias depois) e o cartão do Trello. Não trava a
// tela: se falhar, a ação no sistema já valeu e a próxima chamada acerta o resto.
function organizarDepois(id) {
  chamarServidor('/api/conteudo/organizar', { metodo: 'POST', corpo: { conteudo_id: id } }).catch(console.error);
}


// Dois cliques: o primeiro pede confirmação, o segundo exclui.
let timerExcluir;
async function excluirRascunho() {
  const botao = botoes.excluir;
  if (!botao.dataset.confirmar) {
    botao.dataset.confirmar = '1';
    botao.textContent = 'Clique de novo para excluir';
    timerExcluir = setTimeout(() => {
      delete botao.dataset.confirmar;
      botao.textContent = 'Excluir rascunho';
    }, 4000);
    return;
  }
  clearTimeout(timerExcluir);
  await executar(botao, async () => {
    if (enviandoArquivos()) throw new Error('Espere os arquivos terminarem de subir.');
    await excluirTodas(); // apaga os arquivos do R2 antes (o banco só apagaria as linhas)
    await limparArquivosDaConversa(conteudo.id);
    const { error } = await supabase.from('conteudos').delete().eq('id', conteudo.id);
    if (error) throw new Error('Não foi possível excluir.');
    window.location.replace(`/admin/cliente/?id=${cliente.id}`);
  });
}
