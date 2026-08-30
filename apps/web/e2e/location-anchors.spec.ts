import { expect, test, type Page } from '@playwright/test';

/**
 * Etapa 2 ponta a ponta (RF-02, PRD 8.2).
 *
 * O criterio de aceite da fase e "conclusao possivel apenas com o CEP
 * residencial": o caminho minimo precisa terminar sem que a familia informe
 * nenhum ponto opcional.
 */

/** Setor conhecido pela referencia de geocodificacao (Centro do Rio). */
const CEP_RESIDENCIA = '20060-000';

async function chegarNaEtapaDePontos(page: Page) {
  await page.goto('/inscricao');
  // O React descarta o que for digitado antes de assumir os campos.
  await page.locator('form.mp-form[data-hydrated="true"]').waitFor();
  await page.getByLabel(/mês de nascimento/i).selectOption('3');
  await page.getByLabel(/ano de nascimento/i).selectOption('2024');
  await page.getByRole('radio', { name: /integral/i }).check();
  await page.getByRole('button', { name: /calcular grupamento/i }).click();
  await expect(page.getByRole('heading', { name: /pontos de referência/i })).toBeVisible();
}

test('a inscrição avança apenas com o CEP de residência', async ({ page }) => {
  await chegarNaEtapaDePontos(page);

  // PRD 8.2: os pontos nao pontuam, e a interface precisa dizer isso.
  await expect(page.getByText(/não alteram a pontuação/i)).toBeVisible();

  await page.getByLabel(/CEP de residência/i).fill(CEP_RESIDENCIA);
  await page.getByRole('button', { name: /salvar cep de residência/i }).click();

  await expect(page.getByText(CEP_RESIDENCIA)).toBeVisible();
  await expect(page.getByText(/já pode seguir com a inscrição/i)).toBeVisible();

  // Nenhum ponto opcional foi informado, e nada exige que sejam.
  await expect(page.getByRole('button', { name: /^remover/i })).toHaveCount(0);
});

test('o CEP não localizado não bloqueia a inscrição', async ({ page }) => {
  await chegarNaEtapaDePontos(page);

  // 99999 nao e um setor de CEP do municipio; a geocodificacao falha de verdade.
  await page.getByLabel(/CEP de residência/i).fill('99999-000');
  await page.getByRole('button', { name: /salvar cep de residência/i }).click();

  await expect(page.getByText(/escolher unidades por bairro/i)).toBeVisible();
  await expect(page.getByText(/já pode seguir com a inscrição/i)).toBeVisible();
});

test('os pontos opcionais podem ser adicionados e removidos', async ({ page }) => {
  await chegarNaEtapaDePontos(page);

  await page.getByLabel(/CEP de residência/i).fill(CEP_RESIDENCIA);
  await page.getByRole('button', { name: /salvar cep de residência/i }).click();
  await expect(page.getByText(/já pode seguir com a inscrição/i)).toBeVisible();

  await page.getByLabel(/CEP do novo ponto/i).fill('20071-000');
  await page.getByRole('radio', { name: /trabalho/i }).check();
  await page.getByRole('button', { name: /adicionar ponto/i }).click();

  const remover = page.getByRole('button', { name: /remover trabalho/i });
  await expect(remover).toBeVisible();
  await remover.click();

  await expect(page.getByRole('button', { name: /remover trabalho/i })).toHaveCount(0);
  // A residencia permanece, e nunca oferece remocao.
  await expect(page.getByText(CEP_RESIDENCIA)).toBeVisible();
});
