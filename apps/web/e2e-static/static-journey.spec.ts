import { expect, test, type Page } from '@playwright/test';

/**
 * Jornada completa sobre o build estatico, com a API desligada (ADR-0027).
 *
 * O valor deste arquivo esta na ausencia: se qualquer regra tiver escapado para
 * o servidor, estes testes falham, porque nao ha servidor nenhum atendendo.
 * Cada teste tambem bloqueia explicitamente qualquer requisicao que saia da
 * origem, para que uma chamada acidental apareca como falha e nao como lentidao.
 */

const CEP_RESOLVIVEL = '20060-000';

async function bloquearRedeExterna(page: Page) {
  const externas: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.port === '4321' || url.protocol === 'data:') return route.continue();
    externas.push(url.toString());
    return route.abort();
  });
  return externas;
}

async function preencherInscricao(page: Page) {
  await page.goto('/inscricao/');
  await page.getByLabel(/mês de nascimento/i).selectOption('3');
  await page.getByLabel(/ano de nascimento/i).selectOption('2024');
  await page.getByRole('radio', { name: /integral/i }).check();
  await page.getByRole('button', { name: /calcular grupamento/i }).click();
}

test('calcula o grupamento no navegador, sem servidor', async ({ page }) => {
  const externas = await bloquearRedeExterna(page);
  await preencherInscricao(page);

  await expect(page.getByRole('heading', { name: /grupamento encontrado/i })).toBeVisible();
  await expect(page.getByText('Maternal I', { exact: true })).toBeVisible();
  await expect(page.getByText(/Como chegamos nesse resultado/i)).toBeVisible();
  // PRD 1.2: continua sendo demonstracao, e continua dizendo isso.
  await expect(page.getByText(/Resultado de demonstração/i)).toBeVisible();

  expect(externas).toEqual([]);
});

test('geocodifica o CEP no navegador e declara a margem', async ({ page }) => {
  const externas = await bloquearRedeExterna(page);
  await preencherInscricao(page);

  await page.getByLabel(/CEP de residência/i).fill(CEP_RESOLVIVEL);
  await page.getByRole('button', { name: /salvar cep de residência/i }).click();

  await expect(page.getByText(CEP_RESOLVIVEL)).toBeVisible();
  await expect(page.getByText(/posição aproximada/i)).toBeVisible();
  await expect(page.getByText(/já pode seguir com a inscrição/i)).toBeVisible();

  expect(externas).toEqual([]);
});

test('o CEP fora da referência falha sem bloquear', async ({ page }) => {
  await bloquearRedeExterna(page);
  await preencherInscricao(page);

  await page.getByLabel(/CEP de residência/i).fill('99999-000');
  await page.getByRole('button', { name: /salvar cep de residência/i }).click();

  await expect(page.getByText(/escolher unidades por bairro/i)).toBeVisible();
  await expect(page.getByText(/já pode seguir com a inscrição/i)).toBeVisible();
});

test('os pontos informados sobrevivem a recarregar a página', async ({ page }) => {
  await bloquearRedeExterna(page);
  await preencherInscricao(page);

  await page.getByLabel(/CEP de residência/i).fill(CEP_RESOLVIVEL);
  await page.getByRole('button', { name: /salvar cep de residência/i }).click();
  await expect(page.getByText(CEP_RESOLVIVEL)).toBeVisible();

  await page.reload();
  await preencherInscricao(page);

  // A inscricao nova e outra, mas a anterior continua guardada no dispositivo —
  // e por isso a pagina precisa oferecer como apagar.
  await expect(page.getByRole('heading', { name: /pontos de referência/i })).toBeVisible();
});

test('as páginas institucionais são navegáveis sem servidor', async ({ page }) => {
  await bloquearRedeExterna(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto('/sobre/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
