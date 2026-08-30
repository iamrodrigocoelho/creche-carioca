import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CriterionListResponse, ScoreResultResponse } from '@match/schemas';

import { ScoringStep } from './ScoringStep';

/**
 * Etapa 5 (RF-07). O foco: a pontuação é explicada a partir dos dados
 * estruturados, e a régua se anuncia como demonstração (PRD 1.2).
 */

const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';

const RULE = {
  processCode: 'DEMO-2026',
  version: 1,
  status: 'DEMONSTRACAO' as const,
  sourceYear: 2025,
  confirmationPolicy: 'DECLARADA' as const,
};

function catalog(overrides: Partial<CriterionListResponse> = {}): CriterionListResponse {
  return {
    applicationId: APPLICATION_ID,
    criteria: [
      {
        code: 28,
        text: 'Família inscrita no CadÚnico?',
        order: 1,
        points: 51,
        isTiebreak: false,
        answer: null,
        confirmed: false,
      },
      {
        code: 31,
        text: 'Criança é público-alvo da educação especial?',
        order: 2,
        points: 25,
        isTiebreak: false,
        answer: null,
        confirmed: false,
      },
      {
        code: 29,
        text: 'Possui irmão matriculado na rede?',
        order: 3,
        points: 0,
        isTiebreak: true,
        answer: null,
        confirmed: false,
      },
    ],
    rule: RULE,
    isComplete: false,
    ...overrides,
  };
}

function result(overrides: Partial<ScoreResultResponse> = {}): ScoreResultResponse {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    applicationId: APPLICATION_ID,
    total: 51,
    maxTotal: 76,
    lines: [
      {
        code: 28,
        text: 'CadÚnico',
        order: 1,
        weight: 51,
        awarded: 51,
        answer: true,
        confirmed: false,
        outcome: 'PONTUOU',
      },
      {
        code: 31,
        text: 'Educação especial',
        order: 2,
        weight: 25,
        awarded: 0,
        answer: null,
        confirmed: false,
        outcome: 'NAO_RESPONDIDA',
      },
    ],
    tiebreaks: [{ code: 29, text: 'Irmão matriculado', order: 3, applies: false }],
    rule: RULE,
    computedAt: '2026-08-30T12:00:00.000Z',
    ...overrides,
  };
}

function mockFetch(...bodies: unknown[]) {
  const fetchMock = vi.fn();
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ScoringStep', () => {
  /** PRD 1.2: nunca passar dado de demonstração por oficial. */
  it('anuncia a régua como demonstração e diz de que ano ela veio', async () => {
    mockFetch(catalog());
    render(<ScoringStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByText(/Régua do processo de 2025/)).toBeDefined();
    expect(screen.getByText(/regra de 2026 ainda não foi publicada/i)).toBeDefined();
  });

  it('mostra quanto cada critério vale', async () => {
    mockFetch(catalog());
    render(<ScoringStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByText('Vale 51 pontos')).toBeDefined();
    expect(screen.getByText('Vale 25 pontos')).toBeDefined();
  });

  it('separa os critérios de desempate e diz que não somam', async () => {
    mockFetch(catalog());
    render(<ScoringStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByRole('list', { name: /desempate/i })).toBeDefined();
    expect(screen.getByText(/não somam pontos/i)).toBeDefined();
  });

  it('deixa claro que responder é opcional', async () => {
    mockFetch(catalog());
    render(<ScoringStep applicationId={APPLICATION_ID} />);
    expect(await screen.findByText(/nenhuma é obrigatória/i)).toBeDefined();
  });

  it('envia a resposta e mostra o total recalculado', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(catalog(), result(), catalog({ isComplete: false }));
    render(<ScoringStep applicationId={APPLICATION_ID} />);

    const grupo = await screen.findByRole('group', { name: /CadÚnico/i });
    await user.click(within(grupo).getByLabelText('Sim'));

    await waitFor(() => expect(screen.getByText('51 de 76 pontos')).toBeDefined());
    const corpo = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(corpo).toEqual({ responses: [{ code: 28, answer: true }] });
  });

  /** PRD 8.7: a explicação vem dos dados, não de texto pronto. */
  it('explica cada critério com pontos somados e o motivo', async () => {
    const user = userEvent.setup();
    mockFetch(catalog(), result(), catalog());
    render(<ScoringStep applicationId={APPLICATION_ID} />);

    const grupo = await screen.findByRole('group', { name: /CadÚnico/i });
    await user.click(within(grupo).getByLabelText('Sim'));

    await waitFor(() =>
      expect(screen.getByText(/51 de 51 pontos — somou os pontos/)).toBeDefined(),
    );
    expect(screen.getByText(/0 de 25 pontos — ainda sem resposta/)).toBeDefined();
  });

  it('informa quantos critérios ainda faltam', async () => {
    mockFetch(catalog());
    render(<ScoringStep applicationId={APPLICATION_ID} />);
    expect(await screen.findByText(/0 de 2 critérios respondidos/)).toBeDefined();
  });

  it('reconhece quando tudo que pontua foi respondido', async () => {
    mockFetch(
      catalog({
        isComplete: true,
        criteria: catalog().criteria.map((item) =>
          item.isTiebreak ? item : { ...item, answer: true },
        ),
      }),
    );
    render(<ScoringStep applicationId={APPLICATION_ID} />);
    expect(await screen.findByText(/respondeu todos os critérios que pontuam/i)).toBeDefined();
  });

  it('marca a resposta já registrada', async () => {
    mockFetch(
      catalog({
        criteria: catalog().criteria.map((item) =>
          item.code === 28 ? { ...item, answer: false } : item,
        ),
      }),
    );
    render(<ScoringStep applicationId={APPLICATION_ID} />);

    const grupo = await screen.findByRole('group', { name: /CadÚnico/i });
    expect((within(grupo).getByLabelText('Não') as HTMLInputElement).checked).toBe(true);
  });

  it('avisa quando um desempate favorece a inscrição', async () => {
    const user = userEvent.setup();
    mockFetch(
      catalog(),
      result({ tiebreaks: [{ code: 29, text: 'Irmão matriculado', order: 3, applies: true }] }),
      catalog(),
    );
    render(<ScoringStep applicationId={APPLICATION_ID} />);

    const grupo = await screen.findByRole('group', { name: /irmão matriculado/i });
    await user.click(within(grupo).getByLabelText('Sim'));

    await waitFor(() =>
      expect(screen.getByText(/favorece sua inscrição em caso de empate/i)).toBeDefined(),
    );
  });
});
