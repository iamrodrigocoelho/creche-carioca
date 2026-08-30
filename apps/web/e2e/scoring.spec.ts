import { expect, test, type Page } from '@playwright/test';

/**
 * Etapa 5 ponta a ponta (RF-07, PRD 8.7).
 *
 * O que importa aqui: a pontuação é reconstruída a partir da régua versionada,
 * o detalhamento explica cada critério, e a régua se anuncia como demonstração.
 */

async function chegarNosCriterios(page: Page) {
  await page.goto('/inscricao');
  await page.locator('form.mp-form[data-hydrated="true"]').waitFor();
  await page.getByLabel(/mês de nascimento/i).selectOption('3');
  await page.getByLabel(/ano de nascimento/i).selectOption('2024');
  await page.getByRole('radio', { name: /integral/i }).check();
  await page.getByRole('button', { name: /calcular grupamento/i }).click();
  await expect(page.getByRole('heading', { name: /critérios de classificação/i })).toBeVisible();
}

test('a régua se anuncia como demonstração e diz o ano de origem', async ({ page }) => {
  await chegarNosCriterios(page);

  // PRD 1.2: dado de demonstração nunca pode ser lido como oficial.
  await expect(page.getByText(/Régua do processo de 2025/)).toBeVisible();
  await expect(page.getByText(/regra de 2026 ainda não foi publicada/i)).toBeVisible();
});

test('responder um critério soma o peso e explica o resultado', async ({ page }) => {
  await chegarNosCriterios(page);

  const cadUnico = page.getByRole('group', { name: /CadÚnico/i });
  await cadUnico.getByText('Sim', { exact: true }).click();

  // A régua de 2025 dá 51 pontos ao CadÚnico, de 100 possíveis.
  await expect(page.getByText('51 de 100 pontos')).toBeVisible();
  await expect(page.getByText(/51 de 51 pontos — somou os pontos/)).toBeVisible();
});

test('critério de desempate não soma pontos', async ({ page }) => {
  await chegarNosCriterios(page);

  const desempate = page.getByRole('group', { name: /irmão matriculado/i });
  await desempate.getByText('Sim', { exact: true }).click();

  await expect(page.getByText('0 de 100 pontos')).toBeVisible();
  await expect(page.getByText(/favorece sua inscrição em caso de empate/i)).toBeVisible();
});

test('a resposta pode ser corrigida e o total acompanha', async ({ page }) => {
  await chegarNosCriterios(page);

  const cadUnico = page.getByRole('group', { name: /CadÚnico/i });
  await cadUnico.getByText('Sim', { exact: true }).click();
  await expect(page.getByText('51 de 100 pontos')).toBeVisible();

  await cadUnico.getByText('Não', { exact: true }).click();
  await expect(page.getByText('0 de 100 pontos')).toBeVisible();
});

test('a etapa informa quantos critérios ainda faltam', async ({ page }) => {
  await chegarNosCriterios(page);
  await expect(page.getByText(/0 de 11 critérios respondidos/)).toBeVisible();
});
