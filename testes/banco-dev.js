// Acesso ao banco de desenvolvimento para os testes (RLS e Playwright), nunca o da produção.
// A trava: o SUPABASE_URL do .dev.vars precisa ser o projeto de dev do config.js; senão,
// `pular` traz o motivo e nenhum teste faz chamada nenhuma.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cabecalhosServidor } from '../functions/_lib/servidor.js';
import { SUPABASE_PRODUCAO } from '../functions/_lib/ambiente.js';

const ler = (caminho) => { try { return readFileSync(new URL(caminho, import.meta.url), 'utf8'); } catch { return ''; } };
const vars = Object.fromEntries(ler('../.dev.vars')
  .split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
const config = ler('../public/assets/js/config.js');
export const URL_DEV = config.match(/SUPABASE_URL = DEV \? '([^']+)'/)[1];
export const PUBLICA = config.match(/SUPABASE_ANON_KEY = DEV \? '([^']+)'/)[1];
const urlDoVars = vars.SUPABASE_URL?.replace(/\/+$/, '');
export const pular = (urlDoVars !== URL_DEV || URL_DEV === SUPABASE_PRODUCAO)
  && 'o .dev.vars não aponta para o banco de desenvolvimento';

const SERVICO = cabecalhosServidor({ SUPABASE_SERVICE_ROLE_KEY: vars.SUPABASE_SERVICE_ROLE_KEY ?? '' });

// token: null = anon (só a chave publishable); 'servico' = chave secreta; texto = login.
export async function api(caminho, { metodo = 'GET', corpo, token = 'servico' } = {}) {
  if (pular) throw new Error(pular);
  const headers = token === 'servico' ? { ...SERVICO } : { apikey: PUBLICA, ...(token && { Authorization: `Bearer ${token}` }) };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  headers.Prefer = 'return=representation';
  const resp = await fetch(`${URL_DEV}${caminho}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  const dados = await resp.json().catch(() => null);
  return { status: resp.status, dados };
}

export const linhas = async (caminho, token) => {
  const r = await api(`/rest/v1/${caminho}`, { token });
  return r.status === 200 ? r.dados : [];
};

export const inserir = async (tabela, corpo) => {
  const r = await api(`/rest/v1/${tabela}`, { metodo: 'POST', corpo });
  assert.equal(r.status, 201, `inserir em ${tabela}: ${JSON.stringify(r.dados)}`);
  return r.dados[0];
};

// Login temporário (senha aleatória, e-mail que não existe): devolve id, e-mail, senha e token.
// Quem cria guarda o id e apaga no fim com apagarLogin.
export async function novoLogin(prefixo) {
  const email = `${prefixo}-${crypto.randomUUID().slice(0, 8)}@teste.invalid`;
  const senha = `T-${crypto.randomUUID()}`;
  const { dados } = await api('/auth/v1/admin/users', { metodo: 'POST', corpo: { email, password: senha, email_confirm: true } });
  assert.ok(dados?.id, `criar login ${email}: ${JSON.stringify(dados)}`);
  const login = await api('/auth/v1/token?grant_type=password', { metodo: 'POST', corpo: { email, password: senha }, token: null });
  assert.ok(login.dados?.access_token, `entrar como ${email}`);
  return { id: dados.id, email, senha, token: login.dados.access_token };
}

export const apagarLogin = (id) => api(`/auth/v1/admin/users/${id}`, { metodo: 'DELETE' });
