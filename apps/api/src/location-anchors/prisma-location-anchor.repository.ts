import { Injectable } from '@nestjs/common';

import { Prisma } from '@match/database';
import type { LocationAnchor } from '@match/database';

import type { WriteContext } from '../common/write-context';
import { AuditService } from '../database/audit.service';
import { PrismaService } from '../database/prisma.service';
import {
  UnknownApplicationError,
  type LocationAnchorRecord,
  type LocationAnchorRepository,
  type UpsertLocationAnchorRecord,
} from './location-anchor.repository';

/**
 * Adapter PostgreSQL dos pontos de referencia.
 *
 * Como na Fase 2, escrita e auditoria entram na mesma transacao: um ponto de
 * referencia sem trilha seria um dado pessoal gravado sem rastro (PRD 8.16).
 * O CEP nunca chega inteiro ao evento — `AuditService` redige `cep` antes de
 * persistir o `metadata`.
 */
function toRecord(row: LocationAnchor): LocationAnchorRecord {
  return {
    id: row.id,
    position: row.position,
    kind: row.kind,
    cep: row.cep,
    label: row.label,
    status: row.status,
    latitude: row.latitude,
    longitude: row.longitude,
    precisionKm: row.precisionKm,
    neighborhood: row.neighborhood,
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class PrismaLocationAnchorRepository implements LocationAnchorRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listByApplication(applicationId: string): Promise<LocationAnchorRecord[]> {
    const rows = await this.prisma.client.locationAnchor.findMany({
      where: { applicationId },
      orderBy: { position: 'asc' },
    });
    return rows.map(toRecord);
  }

  async upsert(
    applicationId: string,
    input: UpsertLocationAnchorRecord,
    context: WriteContext,
  ): Promise<LocationAnchorRecord> {
    return this.prisma.client.$transaction(async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        select: { id: true },
      });
      if (!application) throw new UnknownApplicationError(applicationId);

      const data = {
        kind: input.kind,
        cep: input.cep,
        label: input.label ?? null,
        status: input.status,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        precisionKm: input.precisionKm ?? null,
        neighborhood: input.neighborhood ?? null,
        lastValidatedAt: input.lastValidatedAt,
      };

      const anchor = await tx.locationAnchor.upsert({
        where: { applicationId_position: { applicationId, position: input.position } },
        create: { applicationId, position: input.position, ...data },
        update: data,
      });

      await this.audit.record(
        {
          ...context,
          action: 'LOCATION_ANCHOR_UPSERT',
          entity: 'LocationAnchor',
          entityId: anchor.id,
          // `cep` e redigido pelo AuditService; o que resta e o suficiente para
          // auditar sem guardar o dado pessoal.
          metadata: {
            applicationId,
            position: input.position,
            kind: input.kind,
            cep: input.cep,
            status: input.status,
          },
        },
        tx,
      );

      return toRecord(anchor);
    });
  }

  async remove(applicationId: string, position: number, context: WriteContext): Promise<boolean> {
    return this.prisma.client.$transaction(async (tx) => {
      try {
        const anchor = await tx.locationAnchor.delete({
          where: { applicationId_position: { applicationId, position } },
        });

        await this.audit.record(
          {
            ...context,
            action: 'LOCATION_ANCHOR_REMOVE',
            entity: 'LocationAnchor',
            entityId: anchor.id,
            metadata: { applicationId, position, kind: anchor.kind },
          },
          tx,
        );
        return true;
      } catch (error) {
        // P2025: nao havia linha naquela posicao. Remover o que ja nao existe e
        // idempotente do ponto de vista da familia, entao nao vira erro aqui.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          return false;
        }
        throw error;
      }
    });
  }
}
