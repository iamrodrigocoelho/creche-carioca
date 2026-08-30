import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContactListResponse, ContactPointResponse } from '@match/schemas';

import { ContactsStep } from './ContactsStep';

/**
 * Etapa 3 (RF-03, RF-04). O que se testa sao as promessas da interface: que o
 * contato aparece mascarado, que o consentimento e explicito, e que a
 * autorizacao de terceiro e pedida quando precisa ser.
 */

const APPLICATION_ID = '11111111-1111-4111-8111-111111111111';

function phone(overrides: Partial<ContactPointResponse> = {}): ContactPointResponse {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    channel: 'TELEFONE',
    masked: '(21) •••••-4321',
    platform: null,
    label: null,
    relation: 'MAE',
    isPrimary: true,
    priority: 1,
    status: 'INFORMED',
    allowsCall: true,
    allowsSms: false,
    allowsWhatsapp: false,
    allowsSocial: false,
    thirdPartyAuthorized: false,
    duplicateOfId: null,
    consentedAt: '2026-08-30T12:00:00.000Z',
    lastValidatedAt: null,
    ...overrides,
  };
}

function list(contacts: ContactPointResponse[]): ContactListResponse {
  return {
    applicationId: APPLICATION_ID,
    contacts,
    hasReachableContact: contacts.some((c) => c.channel === 'TELEFONE'),
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

describe('ContactsStep', () => {
  it('exibe o telefone mascarado, nunca o número inteiro', async () => {
    mockFetch(list([phone()]));
    render(<ContactsStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByText('(21) •••••-4321')).toBeDefined();
    expect(screen.queryByText(/98765/)).toBeNull();
  });

  it('mostra qual telefone é o principal', async () => {
    mockFetch(list([phone()]));
    render(<ContactsStep applicationId={APPLICATION_ID} />);
    expect(await screen.findByText(/contato principal/i)).toBeDefined();
  });

  it('não oferece remover o único telefone', async () => {
    mockFetch(list([phone()]));
    render(<ContactsStep applicationId={APPLICATION_ID} />);
    await screen.findByText('(21) •••••-4321');
    expect(screen.queryByRole('button', { name: /^remover$/i })).toBeNull();
  });

  it('oferece remover quando há mais de um telefone', async () => {
    mockFetch(
      list([
        phone(),
        phone({
          id: '44444444-4444-4444-8444-444444444444',
          isPrimary: false,
          masked: '(21) ••••-4444',
        }),
      ]),
    );
    render(<ContactsStep applicationId={APPLICATION_ID} />);
    await screen.findByText('(21) ••••-4444');
    expect(screen.getAllByRole('button', { name: /^remover$/i }).length).toBeGreaterThan(0);
  });

  /** PRD 8.3: consentimento por meio, nada presumido além da ligação. */
  it('deixa SMS e WhatsApp desmarcados por padrão', async () => {
    mockFetch(list([]));
    render(<ContactsStep applicationId={APPLICATION_ID} />);

    await screen.findByLabelText(/telefone para contato/i);
    expect((screen.getByLabelText('SMS') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('WhatsApp') as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText('Ligação') as HTMLInputElement).checked).toBe(true);
  });

  it('só libera SMS e WhatsApp com celular informado', async () => {
    const user = userEvent.setup();
    mockFetch(list([]));
    render(<ContactsStep applicationId={APPLICATION_ID} />);

    const campo = await screen.findByLabelText(/telefone para contato/i);
    expect((screen.getByLabelText('SMS') as HTMLInputElement).disabled).toBe(true);

    await user.type(campo, '21987654321');
    expect((screen.getByLabelText('SMS') as HTMLInputElement).disabled).toBe(false);
  });

  /** PRD 8.3: telefone de terceiro exige confirmação de autorização. */
  it('pede confirmação de autorização ao escolher telefone de terceiro', async () => {
    const user = userEvent.setup();
    mockFetch(list([]));
    render(<ContactsStep applicationId={APPLICATION_ID} />);

    await screen.findByLabelText(/telefone para contato/i);
    expect(screen.queryByText(/autorizou o uso do telefone/i)).toBeNull();

    await user.selectOptions(screen.getByLabelText(/de quem é este telefone/i), 'VIZINHO');
    expect(screen.getByText(/autorizou o uso do telefone/i)).toBeDefined();
  });

  it('envia o telefone com os consentimentos escolhidos', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetch(list([]), list([phone()]));
    render(<ContactsStep applicationId={APPLICATION_ID} />);

    await user.type(await screen.findByLabelText(/telefone para contato/i), '(21) 98765-4321');
    await user.click(screen.getByLabelText('WhatsApp'));
    await user.click(screen.getByRole('button', { name: /adicionar telefone/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const corpo = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(corpo).toMatchObject({
      phone: '(21) 98765-4321',
      relation: 'MAE',
      allowsCall: true,
      allowsWhatsapp: true,
      allowsSms: false,
    });
  });

  it('sinaliza telefone repetido sem impedir', async () => {
    mockFetch(
      list([
        phone(),
        phone({
          id: '44444444-4444-4444-8444-444444444444',
          isPrimary: false,
          duplicateOfId: '33333333-3333-4333-8333-333333333333',
        }),
      ]),
    );
    render(<ContactsStep applicationId={APPLICATION_ID} />);
    expect(await screen.findByText(/igual a outro já informado/i)).toBeDefined();
  });

  /** PRD 8.4 e PRD 1.2: a verificação é simulada e precisa dizer isso. */
  it('anuncia que a verificação é simulada e mostra o código', async () => {
    const user = userEvent.setup();
    mockFetch(list([phone()]), {
      contactId: '33333333-3333-4333-8333-333333333333',
      expiresAt: '2026-08-30T12:10:00.000Z',
      simulatedCode: '123456',
      notice: 'Verificação simulada: nenhuma mensagem foi enviada.',
    });
    render(<ContactsStep applicationId={APPLICATION_ID} />);

    await user.click(await screen.findByRole('button', { name: /verificar/i }));
    expect(await screen.findByText(/verificação simulada/i)).toBeDefined();
    expect(screen.getByText(/123456/)).toBeDefined();
  });

  it('avisa que falta telefone quando só há rede social', async () => {
    mockFetch({
      applicationId: APPLICATION_ID,
      contacts: [
        phone({
          id: '55555555-5555-4555-8555-555555555555',
          channel: 'SOCIAL',
          platform: 'INSTAGRAM',
          masked: '@ma•••••',
          isPrimary: false,
        }),
      ],
      hasReachableContact: false,
    });
    render(<ContactsStep applicationId={APPLICATION_ID} />);

    expect(await screen.findByText(/informe ao menos um telefone/i)).toBeDefined();
  });

  it('exibe o perfil social mascarado', async () => {
    mockFetch(
      list([
        phone(),
        phone({
          id: '55555555-5555-4555-8555-555555555555',
          channel: 'SOCIAL',
          platform: 'TIKTOK',
          masked: '@ma•••••',
          isPrimary: false,
        }),
      ]),
    );
    render(<ContactsStep applicationId={APPLICATION_ID} />);
    expect(await screen.findByText(/TikTok · @ma•••••/)).toBeDefined();
  });
});
