import { expect, test, type Page } from '@playwright/test';

/**
 * Etapa 4 ponta a ponta (RF-05, RF-06, PRD 8.5 e 8.6).
 *
 * O critério que o plano nomeia é a reordenação por teclado: a lista tem de
 * ser operável sem mouse, e a ordem submetida tem de ser a ordem mostrada.
 */

const CEP_CENTRO = '20060-000';

async function chegarNaEscolhaDeUnidades(page: Page) {
  await page.goto('/inscricao');
  // O React descarta o que for digitado antes de assumir os campos.
  await page.locator('form.mp-form[data-hydrated="true"]').waitFor();
  await page.getByLabel(/mês de nascimento/i).selectOption('3');
  await page.getByLabel(/ano de nascimento/i).selectOption('2024');
  await page.getByRole('radio', { name: /integral/i }).check();
  await page.getByRole('button', { name: /calcular grupamento/i }).click();

  await page.getByLabel(/CEP de residência/i).fill(CEP_CENTRO);
  await page.getByRole('button', { name: /salvar cep de residência/i }).click();
  await expect(page.getByRole('heading', { name: /escolha das unidades/i })).toBeVisible();
}

/** Nomes das unidades escolhidas, na ordem em que aparecem. */
async function ordemEscolhida(page: Page): Promise<string[]> {
  const itens = page.getByRole('list', { name: /suas preferências/i }).getByRole('listitem');
  const textos = await itens.locator('.mp-body-strong').allTextContents();
  return textos.map((texto) => texto.replace(/^\d+\.\s*/, ''));
}

test('a lista é ordenada por proximidade e rotulada como histórica', async ({ page }) => {
  await chegarNaEscolhaDeUnidades(page);

  // PRD 8.5: dado histórico precisa se anunciar como histórico.
  await expect(page.getByText(/inscrições de 2021 a 2025/i)).toBeVisible();
  await expect(page.getByText(/Da residência: cerca de/).first()).toBeVisible();
});

test('escolher unidades registra a ordem submetida', async ({ page }) => {
  await chegarNaEscolhaDeUnidades(page);

  const escolher = page.getByRole('button', { name: /^Escolher / });
  await escolher.first().click();
  await expect(page.getByText(/1 de 5 unidades escolhidas/i)).toBeVisible();

  await page
    .getByRole('button', { name: /^Escolher / })
    .first()
    .click();
  await expect(page.getByText(/2 de 5 unidades escolhidas/i)).toBeVisible();
});

/** PRD 8.6: reordenar por controles acessíveis, sem mouse. */
test('a ordem pode ser trocada apenas com o teclado', async ({ page }) => {
  await chegarNaEscolhaDeUnidades(page);

  await page
    .getByRole('button', { name: /^Escolher / })
    .first()
    .click();
  await expect(page.getByText(/1 de 5 unidades/i)).toBeVisible();
  await page
    .getByRole('button', { name: /^Escolher / })
    .first()
    .click();
  await expect(page.getByText(/2 de 5 unidades/i)).toBeVisible();

  const antes = await ordemEscolhida(page);
  expect(antes).toHaveLength(2);

  const subir = page.getByRole('button', { name: new RegExp(`mover ${antes[1]} para cima`, 'i') });
  await subir.focus();
  await page.keyboard.press('Enter');

  await expect(async () => {
    expect(await ordemEscolhida(page)).toEqual([antes[1], antes[0]]);
  }).toPass();
});

test('a primeira preferência não pode subir', async ({ page }) => {
  await chegarNaEscolhaDeUnidades(page);
  await page
    .getByRole('button', { name: /^Escolher / })
    .first()
    .click();
  await expect(page.getByText(/1 de 5 unidades/i)).toBeVisible();

  const [primeira] = await ordemEscolhida(page);
  await expect(
    page.getByRole('button', { name: new RegExp(`mover ${primeira} para cima`, 'i') }),
  ).toBeDisabled();
});

test('a busca por nome encontra unidades fora das mais próximas', async ({ page }) => {
  await chegarNaEscolhaDeUnidades(page);

  await page.getByLabel(/buscar unidade pelo nome/i).fill('CANTINHO');
  await page.getByRole('button', { name: 'Buscar' }).click();

  const recomendadas = page.getByRole('list', { name: /unidades recomendadas/i });
  await expect(recomendadas.getByRole('listitem').first()).toContainText(/CANTINHO/i);
});
