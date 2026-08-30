import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import { isDomainError } from '@match/domain';
import type { ApiError, FieldIssue } from '@match/schemas';

import { currentCorrelationId } from '../logging/correlation';
import type { JsonLogger } from '../logging/json-logger';

/**
 * Traducao unica de erros para o formato de `apiErrorSchema`.
 *
 * PRD 13.5: nao expor stack trace. PRD 13.4: nenhuma PII na mensagem.
 * Erros nao mapeados viram 500 com mensagem generica; o detalhe fica apenas no
 * log estruturado, correlacionado pelo `correlationId`.
 */

interface NormalizedError {
  status: number;
  code: string;
  message: string;
  issues?: FieldIssue[];
}

const DOMAIN_ERROR_STATUS: Readonly<Record<string, number>> = {
  INVALID_BIRTH_MONTH: HttpStatus.BAD_REQUEST,
  INVALID_BIRTH_YEAR: HttpStatus.BAD_REQUEST,
  INVALID_REFERENCE_DATE: HttpStatus.BAD_REQUEST,
  INVALID_POLICY: HttpStatus.UNPROCESSABLE_ENTITY,
};

function fromHttpException(exception: HttpException): NormalizedError {
  const status = exception.getStatus();
  const payload = exception.getResponse();

  if (typeof payload === 'object' && payload !== null) {
    const body = payload as Record<string, unknown>;
    const message = typeof body.message === 'string' ? body.message : exception.message;
    return {
      status,
      code: typeof body.code === 'string' ? body.code : `HTTP_${status}`,
      message,
      ...(Array.isArray(body.issues) ? { issues: body.issues as FieldIssue[] } : {}),
    };
  }

  return { status, code: `HTTP_${status}`, message: exception.message };
}

/**
 * Erros do body-parser chegam como `Error` cru com a propriedade `type`.
 * Sem este mapeamento um payload grande demais viraria 500, escondendo do cliente
 * que o limite de PRD 13.5 foi atingido.
 */
const BODY_PARSER_ERRORS: Readonly<Record<string, NormalizedError>> = {
  'entity.too.large': {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    code: 'PAYLOAD_TOO_LARGE',
    message: 'O conteúdo enviado excede o tamanho máximo permitido.',
  },
  'entity.parse.failed': {
    status: HttpStatus.BAD_REQUEST,
    code: 'INVALID_JSON',
    message: 'O corpo da requisição não é um JSON válido.',
  },
  'encoding.unsupported': {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    code: 'UNSUPPORTED_ENCODING',
    message: 'Codificação de conteúdo não suportada.',
  },
};

export function normalizeException(exception: unknown): NormalizedError {
  if (exception instanceof HttpException) return fromHttpException(exception);

  if (exception instanceof Error && 'type' in exception) {
    const mapped = BODY_PARSER_ERRORS[String((exception as { type: unknown }).type)];
    if (mapped) return mapped;
  }

  if (isDomainError(exception)) {
    return {
      status: DOMAIN_ERROR_STATUS[exception.code] ?? HttpStatus.UNPROCESSABLE_ENTITY,
      code: exception.code,
      message: exception.message,
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_ERROR',
    message: 'Não foi possível concluir a operação. Tente novamente.',
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const normalized = normalizeException(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // O stack fica apenas no log do servidor, nunca no corpo da resposta.
      this.logger.error('unhandled_exception', {
        code: normalized.code,
        name: exception instanceof Error ? exception.name : typeof exception,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    const body: ApiError = {
      error: {
        code: normalized.code,
        message: normalized.message,
        correlationId: currentCorrelationId(),
        ...(normalized.issues ? { issues: normalized.issues } : {}),
      },
    };

    response.status(normalized.status).json(body);
  }
}
