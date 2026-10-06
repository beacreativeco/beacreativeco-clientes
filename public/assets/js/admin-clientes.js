import { supabase, chamarServidor } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina, avisar } from './ui.js';

const CAMPOS = 'id, nome, slug, email, instagram, whatsapp, drive_pasta_url, prazo_padrao_dias, contrato_inicio, login_ativo, user_id, trello_board_id';

const lista = document.getElementById('lista-clientes');
const listaVazia = document.getElementById('lista-vazia');
const modelo = document.getElementById('modelo-cliente');
const dialogo = document.getElementById('dialogo-cliente');
const form = document.getElementById('form-cliente');
const avisoForm = document.getElementById('aviso-form');

let clientes = [];
let editandoId = null;

iniciarPagina('admin', async () => {
  document.getElementById('sair').addEventListener('click', sair);
  document.getElementById('novo-cliente').addEventListener('click', () => abrirFormulario());
  lista.addEventListener('click', aoClicarNaLista);
  form.addEventListener('submit', salvar);
  dialogo.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => dialogo.close()));

  await carregarClientes();
  mostrarEspaco().catch(console.error); // não trava a página
  // Voltou de uma exclusão (página do cliente): o aviso vem por aqui.
  try {
    const aviso = sessionStorage.getItem('aviso-clientes');
    if (aviso) {
      sessionStorage.removeItem('aviso-clientes');
      avisar(aviso);
    }
  } catch { /* sem sessionStorage */ }
});

// ---------------------------------------------------------------- armazenamento

const LIMITE_GB = 10; // grátis no R2
const AVISO_GB = 8;

async function mostrarEspaco() {
  const { data: mb, error } = await supabase.rpc('espaco_usado');
  if (error) throw error;
  const gb = Number(mb) / 1024;
  const numero = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 });
  const texto = gb < 1 ? `${numero(Number(mb))} MB de ${LIMITE_GB} GB` : `${numero(gb)} GB de ${LIMITE_GB} GB`;
  document.getElementById('espaco-texto').textContent = texto;
  const barra = document.getElementById('espaco-barra');
  barra.setAttribute('aria-valuenow', gb.toFixed(2));
  barra.setAttribute('aria-valuetext', texto);
  barra.classList.toggle('alerta', gb >= AVISO_GB);
  document.getElementById('espaco-uso').style.width = `${Math.min(100, (gb / LIMITE_GB) * 100)}%`;
  const aviso = document.getElementById('espaco-aviso');
  aviso.hidden = gb < AVISO_GB;
  aviso.textContent = 'Passou de 8 GB: perto do limite grátis de 10 GB. Vale apagar rascunhos antigos que não vão mais ao ar.';
  document.getElementById('espaco').hidden = false;
}

// ---------------------------------------------------------------- lista

async function carregarClientes() {
  const { data, error } = await supabase.from('clientes').select(CAMPOS).is('arquivado_em', null).order('nome');
  if (error) throw error;
  clientes = data;
  desenharLista();
}

function situacaoDoAcesso(c) {
  if (!c.user_id) return { texto: 'Sem acesso', classe: 'sem-acesso', acao: 'convidar', rotulo: 'Enviar convite' };
  if (!c.login_ativo) return { texto: 'Suspenso', classe: 'suspenso', acao: 'reativar', rotulo: 'Reativar' };
  return { texto: 'Acesso ativo', classe: 'ativo', acao: 'suspender', rotulo: 'Suspender' };
}

function desenharLista() {
  listaVazia.hidden = clientes.length > 0;
  lista.hidden = clientes.length === 0;
  lista.replaceChildren(...clientes.map((c) => {
    const item = modelo.content.firstElementChild.cloneNode(true);
    const situacao = situacaoDoAcesso(c);
    item.dataset.id = c.id;
    const nome = item.querySelector('.cliente-nome');
    nome.textContent = c.nome;
    nome.href = `/admin/cliente/?id=${c.id}`;
    item.querySelector('.cliente-meta').textContent =
      (c.instagram ? '@' + c.instagram : c.email) || 'Sem contato cadastrado';
    const selo = item.querySelector('.situacao');
    selo.textContent = situacao.texto;
    selo.classList.add(situacao.classe);
    const botao = item.querySelector('.botao-secundario');
    botao.dataset.acao = situacao.acao;
    botao.textContent = situacao.rotulo;
    return item;
  }));
}

async function aoClicarNaLista(e) {
  const botao = e.target.closest('button[data-acao]');
  if (!botao) return;
  const cliente = clientes.find((c) => c.id === botao.closest('.cliente').dataset.id);
  if (!cliente) return;

  if (botao.dataset.acao === 'editar') return abrirFormulario(cliente);

  botao.disabled = true;
  try {
    if (botao.dataset.acao === 'convidar') await convidar(cliente);
    if (botao.dataset.acao === 'suspender') await mudarAcesso(cliente, false);
    if (botao.dataset.acao === 'reativar') await mudarAcesso(cliente, true);
  } catch (err) {
    console.error(err);
    avisar(err.message || 'Algo deu errado. Tente de novo.', 'erro');
  } finally {
    botao.disabled = false;
  }
}

// ---------------------------------------------------------------- ações

async function convidar(cliente) {
  if (!cliente.email) {
    abrirFormulario(cliente);
    mostrarErroForm('Cadastre o e-mail de acesso antes de enviar o convite.');
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  const resposta = await fetch('/api/convidar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({ cliente_id: cliente.id }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível enviar o convite.');

  avisar(`Convite enviado para ${cliente.email}.`);
  await carregarClientes();
}

async function mudarAcesso(cliente, ativo) {
  const { error } = await supabase.from('clientes').update({ login_ativo: ativo }).eq('id', cliente.id);
  if (error) throw new Error('Não foi possível alterar o acesso.');
  avisar(ativo ? `${cliente.nome} pode entrar de novo.` : `${cliente.nome} não consegue mais entrar.`);
  await carregarClientes();
}

// ---------------------------------------------------------------- formulário

function abrirFormulario(cliente = null) {
  editandoId = cliente?.id ?? null;
  form.reset();
  avisoForm.hidden = true;
  document.getElementById('titulo-dialogo').textContent = cliente ? 'Editar cliente' : 'Novo cliente';

  if (cliente) {
    for (const campo of ['nome', 'email', 'instagram', 'whatsapp', 'drive_pasta_url', 'prazo_padrao_dias', 'contrato_inicio']) {
      form[campo].value = cliente[campo] ?? '';
    }
    if (cliente.instagram) form.instagram.value = '@' + cliente.instagram;
  }

  preencherQuadros(cliente?.trello_board_id ?? '');
  dialogo.showModal();
  form.nome.focus();
}

// Quadros do Trello da Bea (busca uma vez). Se o Trello não responder, o quadro
// atual continua escolhido, para salvar o formulário não desligar o cliente dele.
let quadros;
async function preencherQuadros(atual) {
  const select = form.trello_board_id;
  const opcoes = (lista) => [
    new Option('Nenhum', ''),
    ...lista.map((q) => new Option(q.nome, q.id)),
    ...(atual && !lista.some((q) => q.id === atual) ? [new Option('Quadro atual (não carregou)', atual)] : []),
  ];
  select.replaceChildren(...opcoes(quadros ?? []));
  select.value = atual;
  if (quadros) return;
  try {
    quadros = (await chamarServidor('/api/trello/quadros')).quadros;
    if (!dialogo.open) return;
    select.replaceChildren(...opcoes(quadros));
    select.value = atual;
  } catch (err) {
    console.error(err);
  }
}

function mostrarErroForm(texto) {
  avisoForm.textContent = texto;
  avisoForm.hidden = false;
}

function lerFormulario() {
  const texto = (campo) => form[campo].value.trim() || null;
  const prazo = Number.parseInt(form.prazo_padrao_dias.value, 10);
  return {
    nome: texto('nome'),
    email: texto('email')?.toLowerCase() ?? null,
    instagram: texto('instagram')?.replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '') || null,
    whatsapp: texto('whatsapp')?.replace(/\D/g, '') || null,
    drive_pasta_url: texto('drive_pasta_url'),
    prazo_padrao_dias: Number.isNaN(prazo) ? 2 : prazo,
    contrato_inicio: texto('contrato_inicio'),
    trello_board_id: form.trello_board_id.value || null,
  };
}

function validar(dados) {
  if (!dados.nome) return 'Preencha o nome da marca.';
  if (dados.email && !form.email.checkValidity()) return 'Confira o e-mail de acesso.';
  if (dados.drive_pasta_url && !/^https:\/\//.test(dados.drive_pasta_url)) return 'O link do Drive precisa começar com https://';
  if (dados.prazo_padrao_dias < 0 || dados.prazo_padrao_dias > 30) return 'O prazo precisa ficar entre 0 e 30 dias.';
  return null;
}

async function salvar(e) {
  e.preventDefault();
  avisoForm.hidden = true;
  const dados = lerFormulario();
  const problema = validar(dados);
  if (problema) return mostrarErroForm(problema);

  const original = clientes.find((c) => c.id === editandoId);
  if (original?.user_id && original.email !== dados.email) {
    return mostrarErroForm('Este cliente já tem acesso, então o e-mail de login não pode ser trocado por aqui.');
  }

  const botao = form.querySelector('button[type=submit]');
  botao.disabled = true;
  // O slug só é criado no cadastro; editar o nome não muda links já gerados.
  const { error } = editandoId
    ? await supabase.from('clientes').update(dados).eq('id', editandoId)
    : await inserirComSlugLivre(dados);
  botao.disabled = false;

  if (error) {
    console.error(error);
    return mostrarErroForm('Não foi possível salvar. Tente de novo.');
  }

  dialogo.close();
  avisar(editandoId ? 'Cliente atualizado.' : 'Cliente cadastrado.');
  await carregarClientes().catch(() => avisar('Salvo, mas a lista não atualizou. Recarregue a página.', 'erro'));
}

// O slug sai do nome. Se já existir, tenta marca-2, marca-3...
async function inserirComSlugLivre(dados) {
  const base = gerarSlug(dados.nome) || 'cliente';
  let resultado;
  for (let n = 1; n <= 20; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    resultado = await supabase.from('clientes').insert({ ...dados, slug });
    if (resultado.error?.code !== '23505') break;
  }
  return resultado;
}

function gerarSlug(texto) {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
