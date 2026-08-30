import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreferenceResponse, UnitCard } from '@match/schemas';

import { PreferencesStep } from './PreferencesStep';

/**
 * Etapa 4 (RF-05, RF-06). O foco e o contrato acessivel: reordenar sem mouse,
 * o alerta que informa sem bloquear, e o rotulo de dado historico.
 */

const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';

/** O contrato exige UUID no `id`; deriva um estável a partir do código. */
function uuidFor(code: string): string {
  const digits = code.replace(/\D/g, '').padStart(12, '0').slice(-12);
  return `00000000-0000-4000-8000-${digits}`;
}

function unit(code: string, extras: Partial<UnitCard> = {}): UnitCard {
  return {
    id: uuidFor(code),
    code,
    name: `Creche ${code}`,
    type: 'Creche',
    neighborhood: 'CENTRO',
    cre: 1,
    historicalAgeGroups: ['Maternal I'],
    historicalShifts: ['Integral'],
    demandLevel: 'MEDIA',
    historicalApplications: 100,
    distances: [
      {
        anchorPosition: 1,
        anchorKind: 'RESIDENCIA',
        distance: { km: 1.2, method: 'GEODESICA', precisionKm: 0.8 },
      },
    ],
    nearestKm: 1.2,
    reasons: [{ code: 'PROXIMA_DA_RESIDENCIA', values: { km: 1.2, ponto: 1 } }],
    isFar: false,
    ...extras,
  };
}

function preference(
  code: string,
  position: number,
  extras: Partial<PreferenceResponse> = {},
): PreferenceResponse {
  return {
    position,
    unit: {
      id: uuidFor(code),
      code,
      name: `Creche ${code}`,
      type: 'Creche',
      neighborhood: 'CENTRO',
      demandLevel: 'MEDIA',
    },
    ageGroupCode: 'MATERNAL_I',
    shift: 'INTEGRAL',
    distances: [],
    isFar: false,
    ...extras,
  };
}

const NOTICE = 'Grupamentos, turnos e demanda vêm das inscrições de 2021 a 2025.';

function mockFetch(...bodies: unknown[]) {
  const fetchMock = vi.fn();
  for (const body of bodies) {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => body });
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function recommendations(units: UnitCard[]) {
  return { units, total: units.length, hasAnchors: true, historicalNotice: NOTICE };
}

function preferences(items: PreferenceResponse[]) {
  return { applicationId: APPLICATION_ID, preferences: items };
}

function render_() {
  return render(
    <PreferencesStep applicationId={APPLICATION_ID} ageGroupCode="MATERNAL_I" shift="INTEGRAL" />,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PreferencesStep', () => {
  it('rotula o dado como histórico (PRD 8.5)', async () => {
    mockFetch(recommendations([unit('01001')]), preferences([]));
    render_();
    expect(await screen.findByText(new RegExp(NOTICE.slice(0, 30), 'i'))).toBeDefined();
  });

  it('exibe os campos do card e a distância como estimativa', async () => {
    mockFetch(recommendations([unit('01001')]), preferences([]));
    render_();

    expect(await screen.findByText('Creche 01001')).toBeDefined();
    expect(screen.getByText(/Creche · CENTRO/)).toBeDefined();
    expect(screen.getByText(/Da residência: cerca de 1.2 km/)).toBeDefined();
    expect(screen.getByText(/Grupamentos já atendidos: Maternal I/)).toBeDefined();
  });

  it('explica por que a unidade foi recomendada (PRD 8.5)', async () => {
    mockFetch(recommendations([unit('01001')]), preferences([]));
    render_();
    expect(await screen.findByText(/A 1.2 km da sua residência/)).toBeDefined();
  });

  it('pede ao menos uma unidade para concluir', async () => {
    mockFetch(recommendations([unit('01001')]), preferences([]));
    render_();
    expect(await screen.findByText(/escolha ao menos uma unidade/i)).toBeDefined();
  });

  /** PRD 8.6: reordenar por controles acessíveis, sem depender de mouse. */
  it('reordena por botões de mover, enviando a nova ordem', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(
      recommendations([]),
      preferences([preference('A', 1), preference('B', 2)]),
      preferences([preference('B', 1), preference('A', 2)]),
    );
    render_();

    await user.click(await screen.findByRole('button', { name: /mover creche b para cima/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const corpo = JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string);
    expect(corpo.preferences.map((p: { unitCode: string }) => p.unitCode)).toEqual(['B', 'A']);
  });

  it('não deixa mover a primeira para cima nem a última para baixo', async () => {
    mockFetch(recommendations([]), preferences([preference('A', 1), preference('B', 2)]));
    render_();

    const paraCima = await screen.findByRole('button', { name: /mover creche a para cima/i });
    expect(paraCima.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByRole('button', { name: /mover creche b para baixo/i }).hasAttribute('disabled'),
    ).toBe(true);
  });

  /** PRD 8.6: alertas informam, não bloqueiam. */
  it('avisa sobre unidade distante sem impedir', async () => {
    mockFetch(recommendations([]), preferences([preference('A', 1, { isFar: true })]));
    render_();

    expect(await screen.findByText(/fica longe dos pontos que você informou/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /retirar creche a/i }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('impede escolher além de cinco', async () => {
    mockFetch(
      recommendations([unit('01006')]),
      preferences([1, 2, 3, 4, 5].map((n) => preference(`0100${n}`, n))),
    );
    render_();

    expect(await screen.findByText(/já escolheu cinco unidades/i)).toBeDefined();
    expect(
      screen.getByRole('button', { name: /escolher creche 01006/i }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('marca a unidade já escolhida', async () => {
    mockFetch(recommendations([unit('01001')]), preferences([preference('01001', 1)]));
    render_();
    expect(await screen.findByRole('button', { name: /já escolhida/i })).toBeDefined();
  });

  it('envia a unidade escolhida com o grupamento e o turno da inscrição', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(
      recommendations([unit('01001')]),
      preferences([]),
      preferences([preference('01001', 1)]),
    );
    render_();

    await user.click(await screen.findByRole('button', { name: /escolher creche 01001/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const corpo = JSON.parse(fetchMock.mock.calls[2]?.[1]?.body as string);
    expect(corpo.preferences[0]).toEqual({
      unitCode: '01001',
      ageGroupCode: 'MATERNAL_I',
      shift: 'INTEGRAL',
    });
  });

  it('busca por nome sem filtrar por distância', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(
      recommendations([unit('01001')]),
      preferences([]),
      recommendations([unit('01002')]),
      preferences([]),
    );
    render_();

    await user.type(await screen.findByLabelText(/buscar unidade pelo nome/i), 'cantinho');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain('search=cantinho');
  });
});
