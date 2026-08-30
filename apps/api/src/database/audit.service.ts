import { Injectable } from '@nestjs/common';

import { AuditOrigin, type Prisma } from '@match/database';

import { redact } from '../common/logging/redact';
import { PrismaService } from './prisma.service';

/**
 * Trilha de auditoria (RF-16 / PRD 8.16, 13.8).
 *
 * Toda operacao relevante gera um evento append-only com ator, papel, acao,
 * entidade, instante UTC, correlation ID e origem.
 *
 * PRD 8.16 proibe registrar valor completo de telefone, `@handle`, token ou
 * resposta sensivel. O `metadata` passa pela MESMA funcao de redacao usada nos
 * logs, entao um campo sensivel novo fica protegido nos dois caminhos ao ser
 * adicionado em um unico lugar.
 */

export interface AuditInput {
  readonly actor: string;
  readonly actorRole: string;
  readonly action: string;
  readonly entity: string;
  readonly entityId: string;
  readonly correlationId: string;
  readonly origin?: AuditOrigin;
  readonly metadata?: Record<string, unknown>;
}

/** Cliente ou transacao: auditar dentro da mesma transacao do fato auditado. */
type PrismaExecutor = Pick<PrismaService['client'], 'auditEvent'>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput, executor: PrismaExecutor = this.prisma.client): Promise<void> {
    await executor.auditEvent.create({
      data: {
        actor: input.actor,
        actorRole: input.actorRole,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        origin: input.origin ?? AuditOrigin.API,
        correlationId: input.correlationId,
        // Omitido por completo quando ausente: com `exactOptionalPropertyTypes`
        // um `undefined` explicito nao satisfaz o tipo de entrada do Prisma.
        ...(input.metadata === undefined
          ? {}
          : { metadata: redact(input.metadata) as Prisma.InputJsonValue }),
      },
    });
  }
}
