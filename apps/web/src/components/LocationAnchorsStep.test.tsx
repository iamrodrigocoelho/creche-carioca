import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocationAnchorListResponse, LocationAnchorResponse } from '@match/schemas';

import { LocationAnchorsStep } from './LocationAnchorsStep';

/**
 * Etapa 2 (RF-02). O que se testa e o contrato acessivel e as promessas que a
 * interface faz a familia: que os pontos nao pontuam, que a falha de
 * geocodificacao nao bloqueia, e que a estimativa e apresentada como estimativa.
 */

const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';

function anchor(overrides: Partial<LocationAnchorResponse> = {}): LocationAnchorResponse {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    position: 1,
    kind: 'RESIDENCIA',
    cep: '20931004',
    label: null,
    status: 'RESOLVIDO',
    latitude: -22.9,
    longitude: -43.2,
    precisionKm: 0.8,
    neighborhood: 'CAJU',
    duplicateOfPosition: null,
    lastValidatedAt: '2026-08-30T12:00:00.000Z',
    ...overrides,
  };
}

function list(anchors: LocationAnchorResponse[]): LocationAnchorListResponse {
  return {
    applicationId: APPLICATION_ID,
    anchors,
    hasResidence: anchors.some((item) => item.position === 1),
  };
}

function mockFetch(...responses: LocationAnchorListResponse[]) {
  const fetchMock = vi.fn();
  for (const body of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => body,
    });
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

describe('LocationAnchorsStep', () => {
  it('diz explicitamente que os pontos nao alteram a pontuacao (PRD 8.2)', async () => {
    mockFetch(list([]));
    render(<LocationAnchorsStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByText(/não alteram a pontuação/i)).toBeDefined();
  });

  it('pede o CEP de residencia quando ainda nao ha nenhum', async () => {
    mockFetch(list([]));
    render(<LocationAnchorsStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByLabelText(/CEP de residência/i)).toBeDefined();
    // O tipo nao e perguntado: o primeiro ponto e sempre a residencia.
    expect(screen.queryByRole('group', { name: /tipo do ponto/i })).toBeNull();
  });

  it('apresenta a localizacao como aproximada, com a margem (PRD 8.5)', async () => {
    mockFetch(list([anchor({ precisionKm: 0.8 })]));
    render(<LocationAnchorsStep applicationId={APPLICATION_ID} />);

    const texto = await screen.findByText(/posição aproximada/i);
    expect(texto.textContent).toMatch(/800 metros/);
  });

  it('converte a margem para quilometros quando passa de um', async () => {
    mockFetch(list([anchor({ precisionKm: 2.5 })]));
    render(<LocationAnchorsStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByText(/2,5 km/)).toBeDefined();
  });

  /** PRD 8.2: a falha nao pode ser um beco sem saida. */
  it('oferece o caminho por bairro quando o CEP nao e localizado', async () => {
    mockFetch(
      list([
        anchor({
          status: 'FALHOU',
          latitude: null,
          longitude: null,
          precisionKm: null,
          neighborhood: null,
        }),
      ]),
    );
    render(<LocationAnchorsStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByText(/escolher unidades por bairro/i)).toBeDefined();
  });

  it('sinaliza CEP repetido sem impedir nada', async () => {
    mockFetch(
      list([
        anchor(),
        anchor({
          id: '44444444-4444-4444-8444-444444444444',
          position: 2,
          kind: 'TRABALHO',
          duplicateOfPosition: 1,
        }),
      ]),
    );
    render(<LocationAnchorsStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByText(/igual ao do ponto 1/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /remover trabalho/i }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('nao oferece remover a residencia, que e obrigatoria', async () => {
    mockFetch(list([anchor()]));
    render(<LocationAnchorsStep applicationId={APPLICATION_ID} />);

    await screen.findByText(/20931-004/);
    expect(screen.queryByRole('button', { name: /remover residência/i })).toBeNull();
  });

  it('envia o CEP digitado e atualiza a lista', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(list([]), list([anchor()]));
    render(<LocationAnchorsStep applicationId={APPLICATION_ID} />);

    await user.type(await screen.findByLabelText(/CEP de residência/i), '20931-004');
    await user.click(screen.getByRole('button', { name: /salvar cep de residência/i }));

    await waitFor(() => expect(screen.getByText(/20931-004/)).toBeDefined());

    const [, chamada] = fetchMock.mock.calls;
    expect(JSON.parse(chamada?.[1]?.body as string)).toMatchObject({
      cep: '20931-004',
      kind: 'RESIDENCIA',
    });
  });

  it('avisa quando os tres pontos ja foram informados', async () => {
    mockFetch(
      list([
        anchor(),
        anchor({ id: '44444444-4444-4444-8444-444444444444', position: 2, kind: 'TRABALHO' }),
        anchor({ id: '55555555-5555-4555-8555-555555555555', position: 3, kind: 'REDE_APOIO' }),
      ]),
    );
    render(<LocationAnchorsStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByText(/já informou os três pontos/i)).toBeDefined();
    expect(screen.queryByLabelText(/CEP/i)).toBeNull();
  });
});
