// Fluxos principais no Preview: login, enviar para aprovação (com upload de verdade para o R2
// de dev), aprovar, pedir ajuste e a conversa nos dois lados (com tempo real).
// Contas temporárias (senha aleatória), criadas aqui e apagadas no fim, com os arquivos.
// Trava: só roda se o .dev.vars e o config.js publicados no Preview forem do banco de dev.
import { test, expect } from '@playwright/test';
import { pular, URL_DEV, api, linhas, inserir, novoLogin, apagarLogin } from '../testes/banco-dev.js';
import { PREVIEW } from '../playwright.config.js';

test.describe.configure({ mode: 'serial' });
test.skip(Boolean(pular), pular || '');

const marca = crypto.randomUUID().slice(0, 8);
const t = {};

test.beforeAll(async () => {
  const config = await (await fetch(`${PREVIEW}/assets/js/config.js`)).text();
  if (!config.includes(`DEV ? '${URL_DEV}'`)) throw new Error('O Preview não está apontando para o banco de desenvolvimento.');

  t.bea = await novoLogin('e2e-bea');
  await inserir('admins', { user_id: t.bea.id, nome: 'Bea E2E' });
  t.cli = await novoLogin('e2e-cliente');
  t.cliente = await inserir('clientes', { nome: `E2E ${marca}`, slug: `e2e-${marca}`, email: t.cli.email, user_id: t.cli.id });
  t.paraAjuste = await inserir('conteudos', {
    cliente_id: t.cliente.id, titulo: `Ajuste ${marca}`, formato: 'post', status: 'em_aprovacao',
    prazo_aprovacao: new Date(Date.now() + 2 * 86_400_000).toISOString(),
  });
});

test.afterAll(async () => {
  if (!t.cliente) return;
  // Pela própria exclusão do sistema (apaga também os arquivos do R2 de dev): precisa estar suspenso.
  await api(`/rest/v1/clientes?id=eq.${t.cliente.id}`, { metodo: 'PATCH', corpo: { login_ativo: false } });
  const resp = await fetch(`${PREVIEW}/api/clientes/excluir`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t.bea.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cliente_id: t.cliente.id, nome: t.cliente.nome, manter_vitrine: false }),
  });
  if (!resp.ok) {
    console.error('Limpeza pelo sistema falhou:', resp.status, await resp.text(), '— apagando só no banco (podem sobrar arquivos no R2 de dev).');
    await api(`/rest/v1/clientes?id=eq.${t.cliente.id}`, { metodo: 'DELETE' });
    await apagarLogin(t.cli.id);
  }
  if (t.bea) await apagarLogin(t.bea.id);
});

async function entrar(page, { email, senha }, area) {
  await page.goto('/');
  await page.locator('#email').fill(email);
  await page.locator('#senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL(new RegExp(`/${area}/`));
}

// JPEG feito pelo próprio navegador (o sistema otimiza antes de subir, como faz com a Bea).
async function imagemJpeg(page) {
  const base64 = await page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 400, height: 500 });
    const g = c.getContext('2d');
    g.fillStyle = '#7B85CE';
    g.fillRect(0, 0, 400, 500);
    g.fillStyle = '#FFF5E9';
    g.fillRect(60, 60, 280, 380);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  });
  return { name: 'teste-e2e.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') };
}

const situacao = async (id) => (await linhas(`conteudos?select=status,aprovado_por&id=eq.${id}`))[0];

test('a Bea entra, cria um post com imagem e envia para aprovação', async ({ page }) => {
  await entrar(page, t.bea, 'admin');
  await page.goto(`/admin/conteudo/?cliente=${t.cliente.id}`);
  await page.locator('#titulo').fill(`Post ${marca}`);
  await page.locator('#arquivos').setInputFiles(await imagemJpeg(page));
  await expect(page.locator('#lista-midias li')).toHaveCount(1, { timeout: 60_000 });
  await expect(page.locator('#fila-envio')).toBeHidden({ timeout: 60_000 });

  await page.locator('#enviar').click();
  await expect(page.locator('#toast')).toContainText('Enviado para aprovação.');
  [t.post] = await linhas(`conteudos?select=id,status&cliente_id=eq.${t.cliente.id}&titulo=eq.${encodeURIComponent(`Post ${marca}`)}`);
  expect(t.post?.status).toBe('em_aprovacao');
  expect((await linhas(`midias?select=id&conteudo_id=eq.${t.post.id}`)).length).toBe(1);
});

test('o cliente aprova o post (dois toques)', async ({ page }) => {
  test.skip(!t.post, 'o post não foi enviado');
  await entrar(page, t.cli, 'cliente');
  await expect(page.getByRole('link', { name: new RegExp(`Post ${marca}`) })).toBeVisible();
  await page.goto(`/cliente/conteudo/?id=${t.post.id}`);
  await page.locator('#aprovar').click();
  await expect(page.locator('#aprovar')).toHaveText('Confirmar aprovação');
  await page.locator('#aprovar').click();
  await expect(page.locator('#toast')).toContainText('Conteúdo aprovado.');
  expect(await situacao(t.post.id)).toEqual({ status: 'aprovado', aprovado_por: 'cliente' });
});

test('o cliente pede ajuste com texto', async ({ page }) => {
  await entrar(page, t.cli, 'cliente');
  await page.goto(`/cliente/conteudo/?id=${t.paraAjuste.id}`);
  await page.locator('#abrir-ajuste').click();
  const campo = page.getByPlaceholder('O que você quer mudar?');
  await expect(campo).toBeFocused();
  await campo.fill('Troca a cor do fundo, por favor.');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect.poll(async () => (await situacao(t.paraAjuste.id)).status).toBe('ajuste_solicitado');
  const [pedido] = await linhas(`mensagens?select=texto&conteudo_id=eq.${t.paraAjuste.id}&pedido_ajuste=is.true`);
  expect(pedido?.texto).toBe('Troca a cor do fundo, por favor.');
});

test('conversa: o cliente escreve, a Bea vê e responde, e a resposta chega na hora', async ({ browser }) => {
  const doCliente = await browser.newContext();
  const daBea = await browser.newContext();
  try {
    const cliente = await doCliente.newPage();
    await entrar(cliente, t.cli, 'cliente');
    await cliente.goto('/cliente/mensagens/');
    await cliente.getByRole('textbox', { name: 'Mensagem' }).fill(`Oi Bea ${marca}`);
    await cliente.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(cliente.locator('.conversa-texto', { hasText: `Oi Bea ${marca}` })).toBeVisible();

    const bea = await daBea.newPage();
    await entrar(bea, t.bea, 'admin');
    await bea.goto(`/admin/mensagens/?cliente=${t.cliente.id}`);
    await expect(bea.locator('.conversa-texto', { hasText: `Oi Bea ${marca}` })).toBeVisible();
    await bea.getByRole('textbox', { name: 'Mensagem' }).fill(`Oi cliente ${marca}`);
    await bea.getByRole('button', { name: 'Enviar', exact: true }).click();

    // Tempo real: a página do cliente continua aberta e a resposta aparece sem recarregar.
    await expect(cliente.locator('.conversa-texto', { hasText: `Oi cliente ${marca}` })).toBeVisible();
  } finally {
    await doCliente.close();
    await daBea.close();
  }
});
