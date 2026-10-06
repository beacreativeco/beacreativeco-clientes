import { supabase } from './supabase.js';
import { sair } from './auth.js';
import { iniciarPagina } from './ui.js';
import { FORMATOS, SITUACOES, diaEMes, parametro } from './conteudos.js';

const clienteId = parametro('id');

iniciarPagina('admin', async () => {
  document.getElementById('sair').addEventListener('click', sair);
  if (!clienteId) {
    window.location.replace('/admin/');
    return;
  }

  const [cliente, conteudos] = await Promise.all([
    supabase.from('clientes').select('id, nome, instagram, email').eq('id', clienteId).maybeSingle(),
    supabase
      .from('conteudos')
      .select('id, titulo, formato, data_prevista, status')
      .eq('cliente_id', clienteId)
      .order('data_prevista', { ascending: true, nullsFirst: false })
      .order('criado_em', { ascending: true }),
  ]);
  if (cliente.error) throw cliente.error;
  if (conteudos.error) throw conteudos.error;
  if (!cliente.data) {
    window.location.replace('/admin/');
    return;
  }

  const c = cliente.data;
  document.title = `${c.nome} · BeaCreative`;
  document.getElementById('nome-cliente').textContent = c.nome;
  document.getElementById('contato-cliente').textContent = c.instagram ? '@' + c.instagram : (c.email ?? '');
  document.getElementById('novo-conteudo').href = `/admin/conteudo/?cliente=${c.id}`;

  desenharAgenda(conteudos.data);
});

function desenharAgenda(conteudos) {
  const agenda = document.getElementById('agenda');
  const modelo = document.getElementById('modelo-conteudo');
  document.getElementById('agenda-vazia').hidden = conteudos.length > 0;
  agenda.hidden = conteudos.length === 0;

  agenda.replaceChildren(...conteudos.map((item) => {
    const li = modelo.content.firstElementChild.cloneNode(true);
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
