import { defineConfig, devices } from '@playwright/test';

/**
 * E2E do build estatico (ADR-0027).
 *
 * Serve `out/` com um servidor de arquivos burro, sem API e sem banco — que e
 * exatamente o que a Hostinger oferece. Se algum caminho ainda dependesse do
 * servidor, ele falharia aqui.
 */
export default defineConfig({
  testDir: './e2e-static',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm exec http-server out -p 4321 --silent',
    url: 'http://localhost:4321/inscricao/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
