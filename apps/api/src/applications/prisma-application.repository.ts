import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { ApplicationStatus, AuditOrigin, type Prisma } from '@match/database';

import type { WriteContext } from '../common/write-context';
import { AuditService } from '../database/audit.service';
import { PrismaService } from '../database/prisma.service';
import {
  UnknownProcessError,
  type ApplicationRecord,
  type ApplicationRepository,
  type CreateApplicationRecord,
  type UpdateApplicationRecord,
} from './application.repository';

/**
 * Adapter PostgreSQL da porta de inscricao (ADR-0013).
 *
 * Cada escrita e transacional (PRD 15.6): a inscricao, o evento de status e o
 * evento de auditoria entram juntos ou nao entram. Isso impede o estado em que
 * uma inscricao existe sem trilha, o que violaria PRD 18.3 ("tentativas sem
 * trilha de auditoria: meta zero").
 */

type ApplicationWithChild = Prisma.ApplicationGetPayload<{
  include: { child: true; process: { select: { code: true } } };
}>;

const APPLICATION_INCLUDE = {
  child: true,
  process: { select: { code: true } },
} as const;

function toRecord(row: ApplicationWithChild): ApplicationRecord {
  return {
    id: row.id,
    anonymousChildId: row.child.anonymousRef,
    // A Fase 2 so produz rascunhos; a submissao entra junto com as preferencias.
    status: 'RASCUNHO',
    processId: row.process.code,
    birthYear: row.child.birthYear,
    birthMonth: row.child.birthMonth,
    ...(row.child.sex ? { sex: row.child.sex } : {}),
    desiredShift: row.desiredShift,
    ...(row.referenceDateOverride ? { referenceDate: row.referenceDateOverride } : {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class PrismaApplicationRepository implements ApplicationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateApplicationRecord, context: WriteContext): Promise<ApplicationRecord> {
    return this.prisma.client.$transaction(async (tx) => {
      const process = await tx.process.findUnique({
        where: { code: input.processId },
        select: { id: true },
      });

      if (!process) throw new UnknownProcessError(input.processId);

      const child = await tx.child.create({
        data: {
          // Referencia anonima exposta ao cliente, distinta da chave primaria
          // interna, para nao vazar o identificador de linha (PRD 13.5).
          anonymousRef: randomUUID(),
          birthYear: input.birthYear,
          birthMonth: input.birthMonth,
          ...(input.sex ? { sex: input.sex } : {}),
        },
      });

      const application = await tx.application.create({
        data: {
          processId: process.id,
          childId: child.id,
          status: ApplicationStatus.RASCUNHO,
          desiredShift: input.desiredShift,
          ...(input.referenceDate ? { referenceDateOverride: input.referenceDate } : {}),
        },
        include: APPLICATION_INCLUDE,
      });

      await tx.statusEvent.create({
        data: {
          applicationId: application.id,
          fromStatus: null,
          toStatus: ApplicationStatus.RASCUNHO,
          reason: 'Inscrição criada.',
          correlationId: context.correlationId,
        },
      });

      await this.audit.record(
        {
          actor: context.actor,
          actorRole: context.actorRole,
          action: 'application.created',
          entity: 'Application',
          entityId: application.id,
          correlationId: context.correlationId,
          origin: AuditOrigin.API,
          // Nenhum dado pessoal: apenas o que descreve a operacao (PRD 8.16).
          metadata: { processCode: input.processId, desiredShift: input.desiredShift },
        },
        tx,
      );

      return toRecord(application);
    });
  }

  async findById(id: string): Promise<ApplicationRecord | null> {
    const row = await this.prisma.client.application.findUnique({
      where: { id },
      include: APPLICATION_INCLUDE,
    });

    return row ? toRecord(row) : null;
  }

  async update(
    id: string,
    patch: UpdateApplicationRecord,
    context: WriteContext,
  ): Promise<ApplicationRecord | null> {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.application.findUnique({
        where: { id },
        include: APPLICATION_INCLUDE,
      });

      if (!current) return null;

      const childChanged =
        patch.birthYear !== undefined || patch.birthMonth !== undefined || patch.sex !== undefined;

      if (childChanged) {
        await tx.child.update({
          where: { id: current.childId },
          data: {
            ...(patch.birthYear !== undefined ? { birthYear: patch.birthYear } : {}),
            ...(patch.birthMonth !== undefined ? { birthMonth: patch.birthMonth } : {}),
            ...(patch.sex !== undefined ? { sex: patch.sex } : {}),
          },
        });
      }

      const application = await tx.application.update({
        where: { id },
        data: {
          ...(patch.desiredShift !== undefined ? { desiredShift: patch.desiredShift } : {}),
          ...(patch.referenceDate !== undefined
            ? { referenceDateOverride: patch.referenceDate }
            : {}),
        },
        include: APPLICATION_INCLUDE,
      });

      await this.audit.record(
        {
          actor: context.actor,
          actorRole: context.actorRole,
          action: 'application.updated',
          entity: 'Application',
          entityId: application.id,
          correlationId: context.correlationId,
          origin: AuditOrigin.API,
          // Apenas os NOMES dos campos alterados. Os valores ficam de fora:
          // mes e ano de nascimento sao dado pessoal (PRD 13.2).
          metadata: { changedFields: Object.keys(patch).sort() },
        },
        tx,
      );

      return toRecord(application);
    });
  }
}
