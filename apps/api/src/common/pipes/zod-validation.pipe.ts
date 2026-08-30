import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

import type { FieldIssue } from '@match/schemas';

/**
 * Validacao no limite da API (PRD 13.5 "Validar toda entrada no limite da API").
 *
 * A excecao carrega apenas o caminho do campo e a mensagem da regra. O valor
 * recebido NUNCA e ecoado de volta, porque pode conter dado pessoal
 * (PRD 13.4 "Proibir PII em ... mensagens de erro").
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);

    if (result.success) return result.data;

    const issues: FieldIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.join('.') || '(raiz)',
      message: issue.message,
    }));

    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: 'Alguns campos precisam ser corrigidos.',
      issues,
    });
  }
}
