import { expect, test } from '@playwright/test';

/**
 * Smoke E2E da fatia da Fase 1: da pagina inicial ate o grupamento explicado,
 * atravessando web -> API -> dominio com servidores reais.
 */

test('a jornada calcula e explica o grupamento etário', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Iniciar inscrição' }).first().click();

  await expect(page).toHaveURL(/\/inscricao$/);

  await page.getByLabel(/mês de nascimento/i).selectOption('3');
  await page.getByLabel(/ano de nascimento/i).selectOption('2024');
  await page.getByRole('radio', { name: /integral/i }).check();
  await page.getByRole('button', { name: /calcular grupamento/i }).click();

  await expect(page.getByRole('heading', { name: /grupamento encontrado/i })).toBeVisible();
  await expect(page.getByText('Maternal I', { exact: true })).toBeVisible();
  await expect(page.getByText(/Como chegamos nesse resultado/i)).toBeVisible();
  // PRD 1.2: o resultado nunca pode ser lido como dado oficial.
  await expect(page.getByText(/Resultado de demonstração/i)).toBeVisible();
});

test('o formulário é operável apenas por teclado e reporta erros', async ({ page }) => {
  await page.goto('/inscricao');

  await page.getByRole('button', { name: /calcular grupamento/i }).press('Enter');

  const summary = page.locator('#mp-error-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute('role', 'alert');
  await expect(summary).toContainText(/problemas no formulário/i);
  await expect(page.getByLabel(/mês de nascimento/i)).toHaveAttribute('aria-invalid', 'true');
});

test('o logotipo oficial é carregado de /img/logo sem alteração', async ({ page }) => {
  await page.goto('/');

  const logo = page.getByAltText('Prefeitura da Cidade do Rio de Janeiro - Educação').first();
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute('src', /^\/img\/logo\//);
});
