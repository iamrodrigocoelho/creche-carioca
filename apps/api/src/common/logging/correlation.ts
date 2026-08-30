import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Correlation ID por requisicao (PRD 16.1 e 16.3).
 *
 * O valor recebido do cliente e aceito apenas se tiver formato seguro; caso
 * contrario um novo UUID e gerado. Isso evita que um cabecalho arbitrario
 * contamine logs com conteudo injetado (log forging).
 */

const SAFE_CORRELATION_ID = /^[A-Za-z0-9-]{8,64}$/;

export const CORRELATION_HEADER = 'x-correlation-id';

interface RequestContext {
  readonly correlationId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function currentCorrelationId(): string {
  return storage.getStore()?.correlationId ?? 'no-correlation-id';
}

export function normalizeCorrelationId(candidate: unknown): string {
  return typeof candidate === 'string' && SAFE_CORRELATION_ID.test(candidate)
    ? candidate
    : randomUUID();
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const correlationId = normalizeCorrelationId(request.headers[CORRELATION_HEADER]);
    response.setHeader(CORRELATION_HEADER, correlationId);
    storage.run({ correlationId }, () => next());
  }
}
