/**
 * Redacao automatica de campos sensiveis (PRD 16.1).
 *
 * PRD 13.4 proibe PII em logs, traces, metricas, URLs e mensagens de erro.
 * A lista abaixo cobre os campos ja previstos pelo modelo canonico (PRD 11),
 * inclusive os das fases seguintes, para que nenhum log nasca vazando dado.
 */

const SENSITIVE_KEYS = new Set(
  [
    'phone',
    'phoneNumber',
    'telefone',
    'msisdn',
    'e164',
    'email',
    'handle',
    'socialHandle',
    'cep',
    'postalCode',
    'zipCode',
    'latitude',
    'longitude',
    'lat',
    'lng',
    'address',
    'endereco',
    'token',
    'accessToken',
    'refreshToken',
    'responseToken',
    'password',
    'secret',
    'authorization',
    'cookie',
    'setCookie',
    'apiKey',
    'guardianName',
    'childName',
    'nome',
    'criterionResponses',
    'respostas',
  ].map((key) => key.toLowerCase()),
);

export const REDACTED = '[REDACTED]';

const MAX_DEPTH = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return REDACTED;
  if (value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    // Bloqueia prototype pollution ao reconstruir o objeto (PRD 13.5).
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    output[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : redact(entry, depth + 1);
  }
  return output;
}

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}
