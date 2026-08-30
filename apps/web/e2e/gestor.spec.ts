import { expect, test } from '@playwright/test';

/**
 * E2E do painel do gestor (RF-10).
 *
 * A pagina e estatica e nao depende da API: o que precisa ser verificado com
 * navegador real e o recorte — mudar o filtro tem de mudar as tabelas e anunciar
 * o novo escopo — e a promessa de PRD 1.2 de que o dado nunca se apresenta como
 * oficial.
 */

test('o painel declara o dado como sintético e apresenta as três leituras', async ({ page }) => {
  await page.goto('/gestor');

  await expect(page.getByRole('heading', { level: 1, name: /painel do gestor/i })).toBeVisible();
  await expect(page.getByText(/não é a fila oficial da SME/i)).toBeVisible();

  await expect(page.getByRole('heading', { name: /creches mais procuradas/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /fila de espera por território/i })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /comparação com os processos anteriores/i }),
  ).toBeVisible();
});

test('o recorte por território é operável por teclado e anuncia o novo escopo', async ({
  page,
}) => {
  await page.goto('/gestor');

  const scope = page.getByRole('status');
  await expect(scope).toContainText('toda a rede');

  // PRD 17: navegacao integral por teclado, sem depender de ponteiro.
  const territory = page.getByLabel('Território', { exact: true });
  await territory.focus();
  await expect(territory).toBeFocused();
  await territory.selectOption('CRE-09');

  await expect(scope).toContainText('9ª CRE');
  const regions = page.getByRole('table', { name: /fila por coordenadoria/i });
  await expect(regions.getByRole('row')).toHaveCount(2); // cabecalho + 1 territorio

  await page.getByRole('button', { name: /limpar recorte/i }).click();
  await expect(scope).toContainText('toda a rede');
});

test('a série histórica tem equivalente textual e o gráfico fica fora do leitor de tela', async ({
  page,
}) => {
  await page.goto('/gestor');

  await expect(page.locator('.mp-trend')).toHaveAttribute('aria-hidden', 'true');
  const history = page.getByRole('table', { name: /equivalente textual do gráfico/i });
  await expect(history).toBeVisible();
  await expect(history.getByText('DEMO-2026')).toBeVisible();
});
