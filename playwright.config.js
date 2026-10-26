// Testes de ponta a ponta (e2e/) no Preview da dev, com o banco e o R2 de desenvolvimento.
// Nunca na produção: o endereço é fixo e o próprio teste confere o banco (testes/banco-dev.js).
import { defineConfig, devices } from '@playwright/test';

export const PREVIEW = 'https://dev.beacreativeco-clientes.pages.dev';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: PREVIEW,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true } },
  ],
});
