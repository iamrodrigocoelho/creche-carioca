/**
 * Erros de dominio. Carregam apenas um codigo estavel e detalhes nao sensiveis,
 * para que a camada HTTP possa traduzi-los sem vazar PII nem stack trace
 * (PRD 13.4 "Proibir PII em logs, traces, metricas, URLs e mensagens de erro"
 * e PRD 13.5 "Nao expor stack traces em producao").
 */
export type DomainErrorCode =
  'INVALID_BIRTH_MONTH' | 'INVALID_BIRTH_YEAR' | 'INVALID_REFERENCE_DATE' | 'INVALID_POLICY';

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly details: Readonly<Record<string, string | number>>;

  constructor(
    code: DomainErrorCode,
    message: string,
    details: Readonly<Record<string, string | number>> = {},
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
