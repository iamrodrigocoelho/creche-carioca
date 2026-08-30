import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApplicationResponse } from '@match/schemas';

import { ApplicationForm } from './ApplicationForm';

/**
 * Teste de componente com foco em acessibilidade e estados (PRD 17, 20, 14.7).
 * O que importa aqui e o contrato acessivel do formulario, nao a aparencia.
 */

const successResponse: ApplicationResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  anonymousChildId: '22222222-2222-4222-8222-222222222222',
  status: 'RASCUNHO',
  processId: 'DEMO-2026',
  child: { birthYear: 2024, birthMonth: 3 },
  desiredShift: 'INTEGRAL',
  ageGroup: {
    outcome: 'MATCHED',
    code: 'MATERNAL_I',
    label: 'Maternal I',
    ageInMonths: 24,
    referenceDate: '2026-03-31',
    policy: {
      id: 'age-group-policy-demo-2026',
      version: 1,
      status: 'DEMONSTRACAO',
      processId: 'DEMO-2026',
    },
    explanation: [
      {
        code: 'BIRTH_INPUT',
        values: { birthYear: 2024 },
        summary: 'Nascimento informado: 03/2024.',
      },
      { code: 'AGE_IN_MONTHS', values: { ageInMonths: 24 }, summary: 'Idade: 2 anos.' },
    ],
  },
  createdAt: '2026-08-30T12:00:00.000Z',
  updatedAt: '2026-08-30T12:00:00.000Z',
};

beforeEach(() => {
  globalThis.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/mês de nascimento/i), '3');
  await user.selectOptions(screen.getByLabelText(/ano de nascimento/i), '2024');
  await user.click(screen.getByRole('radio', { name: /integral/i }));
}

describe('ApplicationForm', () => {
  it('associa rotulo, dica e controle de cada campo', () => {
    render(<ApplicationForm />);

    expect(screen.getByLabelText(/mês de nascimento/i)).toBeDefined();
    expect(screen.getByLabelText(/ano de nascimento/i)).toBeDefined();
    expect(screen.getByRole('group', { name: /turno desejado/i })).toBeDefined();
    expect(screen.getByLabelText(/sexo da criança/i)).toBeDefined();
  });

  it('mostra resumo de erros e marca os campos como invalidos ao enviar vazio', async () => {
    const user = userEvent.setup();
    render(<ApplicationForm />);

    await user.click(screen.getByRole('button', { name: /calcular grupamento/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/problemas no formulário/i);
    expect(screen.getByLabelText(/mês de nascimento/i).getAttribute('aria-invalid')).toBe('true');
  });

  it('nao chama a API quando a validacao do cliente falha', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    render(<ApplicationForm />);

    await user.click(screen.getByRole('button', { name: /calcular grupamento/i }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('limpa o erro do campo assim que ele e corrigido', async () => {
    const user = userEvent.setup();
    render(<ApplicationForm />);

    await user.click(screen.getByRole('button', { name: /calcular grupamento/i }));
    expect(screen.getByLabelText(/mês de nascimento/i).getAttribute('aria-invalid')).toBe('true');

    await user.selectOptions(screen.getByLabelText(/mês de nascimento/i), '3');

    expect(screen.getByLabelText(/mês de nascimento/i).getAttribute('aria-invalid')).toBe('false');
  });

  it('exibe o resultado com a explicacao estruturada e o selo de demonstracao', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(successResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    render(<ApplicationForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /calcular grupamento/i }));

    await waitFor(() => expect(screen.getByText(/Maternal I/)).toBeDefined());
    expect(screen.getByText(/Resultado de demonstração/i)).toBeDefined();
    expect(screen.getByText(/Nascimento informado: 03\/2024\./)).toBeDefined();
  });

  it('envia chave de idempotencia (PRD 12.4)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(successResponse), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const user = userEvent.setup();
    render(<ApplicationForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /calcular grupamento/i }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toMatch(/^[0-9a-f]{32}$/);
  });

  it('mostra o estado de erro quando a API falha, com o codigo de correlacao', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'UNKNOWN_PROCESS',
            message: 'Processo indisponível.',
            correlationId: 'abc-123',
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const user = userEvent.setup();
    render(<ApplicationForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /calcular grupamento/i }));

    await waitFor(() => expect(screen.getByText(/Processo indisponível\./)).toBeDefined());
    expect(screen.getByText(/abc-123/)).toBeDefined();
  });

  it('mostra o estado de erro quando a rede falha', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const user = userEvent.setup();
    render(<ApplicationForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: /calcular grupamento/i }));

    await waitFor(() => expect(screen.getByText(/falar com o servidor/i)).toBeDefined());
  });

  it('restaura o rascunho salvo (PRD 17)', async () => {
    globalThis.localStorage.setItem(
      'match-perfeito:rascunho:inscricao',
      JSON.stringify({ birthMonth: '5', birthYear: '2023', desiredShift: 'PARCIAL', sex: '' }),
    );

    render(<ApplicationForm />);

    await waitFor(() =>
      expect((screen.getByLabelText(/mês de nascimento/i) as HTMLSelectElement).value).toBe('5'),
    );
    expect((screen.getByRole('radio', { name: /parcial/i }) as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
