import { expect, test, type Page } from '@playwright/test';

/**
 * Etapa 3 ponta a ponta (RF-03, RF-04, PRD 8.3 e 8.4).
 *
 * O critério que importa aqui é o de PRD 8.4: rede social nunca pode ser o
 * único contato. E o de PRD 13.4: o número completo não aparece na tela depois
 * de salvo.
 */

const CELULAR = '(21) 98765-4321';
const OUTRO_CELULAR = '(21) 91234-5678';

async function chegarNaEtapaDeContatos(page: Page) {
  await page.goto('/inscricao');
  await page.getByLabel(/mês de nascimento/i).selectOption('3');
  await page.getByLabel(/ano de nascimento/i).selectOption('2024');
  await page.getByRole('radio', { name: /integral/i }).check();
  await page.getByRole('button', { name: /calcular grupamento/i }).click();
  await expect(page.getByRole('heading', { name: 'Contatos' })).toBeVisible();
}

test('a inscrição avança com um telefone', async ({ page }) => {
  await chegarNaEtapaDeContatos(page);

  await expect(page.getByText(/informe ao menos um telefone/i)).toBeVisible();

  await page.getByLabel(/telefone para contato/i).fill(CELULAR);
  await page.getByRole('button', { name: /adicionar telefone/i }).click();

  await expect(page.getByText('(21) •••••-4321')).toBeVisible();
  await expect(page.getByText(/já pode seguir com a inscrição/i)).toBeVisible();

  // PRD 13.4: o número completo não volta para a tela depois de gravado.
  await expect(page.getByText('98765-4321')).toHaveCount(0);
});

test('o único telefone não pode ser removido', async ({ page }) => {
  await chegarNaEtapaDeContatos(page);
  await page.getByLabel(/telefone para contato/i).fill(CELULAR);
  await page.getByRole('button', { name: /adicionar telefone/i }).click();
  await expect(page.getByText('(21) •••••-4321')).toBeVisible();

  await expect(page.getByRole('button', { name: /^remover$/i })).toHaveCount(0);
});

test('o segundo telefone pode virar principal e o primeiro pode sair', async ({ page }) => {
  await chegarNaEtapaDeContatos(page);
  await page.getByLabel(/telefone para contato/i).fill(CELULAR);
  await page.getByRole('button', { name: /adicionar telefone/i }).click();
  await expect(page.getByText(/contato principal/i)).toBeVisible();

  await page.getByLabel(/outro telefone/i).fill(OUTRO_CELULAR);
  await page.getByRole('button', { name: /adicionar telefone/i }).click();
  await expect(page.getByText('(21) •••••-5678')).toBeVisible();

  await page.getByRole('button', { name: /tornar principal/i }).click();
  await expect(page.getByRole('button', { name: /tornar principal/i })).toHaveCount(1);

  await page
    .getByRole('button', { name: /^remover$/i })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /^remover$/i })).toHaveCount(0);
});

/** PRD 8.4: rede social nunca pode ser o único contato. */
test('rede social sozinha não conclui a etapa', async ({ page }) => {
  await chegarNaEtapaDeContatos(page);

  await page.getByLabel('Perfil').fill('maria.silva');
  await page.getByRole('button', { name: /adicionar perfil/i }).click();

  await expect(page.getByText('Instagram · @ma•••••••••')).toBeVisible();
  await expect(page.getByText(/informe ao menos um telefone/i)).toBeVisible();
});

/** PRD 8.3: telefone de terceiro exige autorização confirmada. */
test('telefone de terceiro exige confirmar autorização', async ({ page }) => {
  await chegarNaEtapaDeContatos(page);

  await page.getByLabel(/telefone para contato/i).fill(CELULAR);
  await page.getByLabel(/de quem é este telefone/i).selectOption('VIZINHO');
  await page.getByRole('button', { name: /adicionar telefone/i }).click();

  await expect(page.getByText(/não foi possível salvar/i)).toBeVisible();

  await page.getByRole('checkbox', { name: /autorizou o uso do telefone/i }).check();
  await page.getByRole('button', { name: /adicionar telefone/i }).click();
  await expect(page.getByText('(21) •••••-4321')).toBeVisible();
});

test('a verificação simulada confirma o telefone', async ({ page }) => {
  await chegarNaEtapaDeContatos(page);
  await page.getByLabel(/telefone para contato/i).fill(CELULAR);
  await page.getByRole('button', { name: /adicionar telefone/i }).click();
  await expect(page.getByText('(21) •••••-4321')).toBeVisible();

  await page.getByRole('button', { name: /verificar/i }).click();
  const aviso = page.getByText(/verificação simulada/i);
  await expect(aviso).toBeVisible();

  // O código vem na própria tela porque nada é enviado nesta demonstração.
  const texto = (await aviso.textContent()) ?? '';
  const codigo = /\b(\d{6})\b/.exec(texto)?.[1] ?? '';
  expect(codigo).toHaveLength(6);

  await page.getByLabel(/código de 6 dígitos/i).fill(codigo);
  await page.getByRole('button', { name: /confirmar código/i }).click();

  await expect(page.getByText(/Verificado/)).toBeVisible();
});
