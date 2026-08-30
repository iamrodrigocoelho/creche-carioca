import { defineConfig, devices } from '@playwright/test';

/**
 * Testes E2E (PRD 14.5). A Fase 1 cobre apenas o smoke da fatia entregue; os dez
 * cenarios obrigatorios sao adicionados conforme as fases correspondentes forem
 * implementadas.
 *
 * O `webServer` sobe API e web reais - nao ha mock de rede.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @match/api start',
      url: 'http://localhost:3333/health/live',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @match/web start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
