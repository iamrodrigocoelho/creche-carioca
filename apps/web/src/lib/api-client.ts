import {
  apiErrorSchema,
  applicationSchema,
  contactChallengeSchema,
  contactListSchema,
  locationAnchorListSchema,
  type ApiError,
  type ApplicationResponse,
  type CreateApplicationInput,
  type CreateLocationAnchorInput,
  type ContactChallengeResponse,
  type ContactListResponse,
  type CreatePhoneContactInput,
  type CreateSocialContactInput,
  type LocationAnchorListResponse,
  type VerifyContactInput,
} from '@match/schemas';

import { API_URL } from './config';

/**
 * Cliente HTTP da API.
 *
 * A resposta e validada com o MESMO schema publicado pela API, entao um contrato
 * quebrado falha aqui em vez de renderizar dado invalido. Nenhuma mensagem de
 * erro do servidor e concatenada em HTML - a renderizacao usa texto puro do React,
 * o que neutraliza XSS refletido (PRD 13.5).
 */

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ApiError['error'] };

const NETWORK_ERROR: ApiError['error'] = {
  code: 'NETWORK_ERROR',
  message: 'Não foi possível falar com o servidor. Verifique a conexão e tente novamente.',
  correlationId: 'sem-correlacao',
};

const CONTRACT_ERROR: ApiError['error'] = {
  code: 'CONTRACT_MISMATCH',
  message: 'A resposta do servidor não pôde ser interpretada.',
  correlationId: 'sem-correlacao',
};

async function parseError(response: Response): Promise<ApiError['error']> {
  try {
    const parsed = apiErrorSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error : CONTRACT_ERROR;
  } catch {
    return CONTRACT_ERROR;
  }
}

export async function createApplication(
  input: CreateApplicationInput,
  options: { readonly idempotencyKey?: string; readonly signal?: AbortSignal } = {},
): Promise<ApiResult<ApplicationResponse>> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // PRD 12.4: evita criar duas inscricoes se a familia reenviar o formulario.
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: JSON.stringify(input),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  if (!response.ok) {
    return { ok: false, error: await parseError(response) };
  }

  const parsed = applicationSchema.safeParse(await response.json());
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: CONTRACT_ERROR };
}

/** Chave de idempotencia opaca, sem qualquer dado da inscricao. */
export function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID().replaceAll('-', '');
}

/**
 * Requisicao JSON generica com validacao da resposta pelo schema publicado.
 *
 * Extraida quando o segundo endpoint chegou (RF-02): repetir o tratamento de
 * rede, de erro e de contrato em cada funcao levaria a divergencia silenciosa
 * entre elas.
 */
async function requestJson<T>(
  path: string,
  init: RequestInit,
  parse: (value: unknown) => { success: true; data: T } | { success: false },
): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  if (!response.ok) {
    return { ok: false, error: await parseError(response) };
  }

  const parsed = parse(await response.json());
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: CONTRACT_ERROR };
}

const parseAnchorList = (value: unknown) =>
  locationAnchorListSchema.safeParse(value) as
    { success: true; data: LocationAnchorListResponse } | { success: false };

export async function listLocationAnchors(
  applicationId: string,
): Promise<ApiResult<LocationAnchorListResponse>> {
  return requestJson(
    `/applications/${applicationId}/location-anchors`,
    { method: 'GET' },
    parseAnchorList,
  );
}

export async function upsertLocationAnchor(
  applicationId: string,
  input: CreateLocationAnchorInput,
): Promise<ApiResult<LocationAnchorListResponse>> {
  return requestJson(
    `/applications/${applicationId}/location-anchors`,
    { method: 'POST', body: JSON.stringify(input) },
    parseAnchorList,
  );
}

export async function removeLocationAnchor(
  applicationId: string,
  position: number,
): Promise<ApiResult<LocationAnchorListResponse>> {
  return requestJson(
    `/applications/${applicationId}/location-anchors/${position}`,
    { method: 'DELETE' },
    parseAnchorList,
  );
}

const parseContactList = (value: unknown) =>
  contactListSchema.safeParse(value) as
    { success: true; data: ContactListResponse } | { success: false };

export async function listContacts(applicationId: string): Promise<ApiResult<ContactListResponse>> {
  return requestJson(
    `/applications/${applicationId}/contacts`,
    { method: 'GET' },
    parseContactList,
  );
}

export async function addPhoneContact(
  applicationId: string,
  input: CreatePhoneContactInput,
): Promise<ApiResult<ContactListResponse>> {
  return requestJson(
    `/applications/${applicationId}/contacts/phones`,
    { method: 'POST', body: JSON.stringify(input) },
    parseContactList,
  );
}

export async function addSocialContact(
  applicationId: string,
  input: CreateSocialContactInput,
): Promise<ApiResult<ContactListResponse>> {
  return requestJson(
    `/applications/${applicationId}/contacts/social`,
    { method: 'POST', body: JSON.stringify(input) },
    parseContactList,
  );
}

export async function setPrimaryContact(
  applicationId: string,
  contactId: string,
): Promise<ApiResult<ContactListResponse>> {
  return requestJson(
    `/applications/${applicationId}/contacts/${contactId}/primary`,
    { method: 'PUT' },
    parseContactList,
  );
}

export async function removeContact(
  applicationId: string,
  contactId: string,
): Promise<ApiResult<ContactListResponse>> {
  return requestJson(
    `/applications/${applicationId}/contacts/${contactId}`,
    { method: 'DELETE' },
    parseContactList,
  );
}

export async function startContactVerification(
  applicationId: string,
  contactId: string,
): Promise<ApiResult<ContactChallengeResponse>> {
  return requestJson(
    `/applications/${applicationId}/contacts/${contactId}/verification`,
    { method: 'POST' },
    (value) =>
      contactChallengeSchema.safeParse(value) as
        { success: true; data: ContactChallengeResponse } | { success: false },
  );
}

export async function confirmContactVerification(
  applicationId: string,
  contactId: string,
  input: VerifyContactInput,
): Promise<ApiResult<ContactListResponse>> {
  return requestJson(
    `/applications/${applicationId}/contacts/${contactId}/verification`,
    { method: 'PUT', body: JSON.stringify(input) },
    parseContactList,
  );
}
