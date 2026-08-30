import { Injectable } from '@nestjs/common';

import type { ContactPoint } from '@match/database';

import type { WriteContext } from '../common/write-context';
import { AuditService } from '../database/audit.service';
import { PrismaService } from '../database/prisma.service';
import {
  UnknownApplicationError,
  type ContactRecord,
  type ContactRepository,
  type CreateContactRecord,
  type OtpChallenge,
  type PrimaryAssignment,
} from './contact.repository';
import type { ContactStatus } from '@match/domain';

/**
 * Adapter PostgreSQL dos contatos.
 *
 * Como nas fases anteriores, escrita e auditoria entram na mesma transacao. O
 * `metadata` do evento passa pela redacao do `AuditService`, que ja cobre
 * `phone`, `handle` e afins — o numero completo nunca chega a trilha (PRD 8.16).
 */
function toRecord(row: ContactPoint): ContactRecord {
  return {
    id: row.id,
    channel: row.channel,
    e164: row.e164,
    platform: row.platform,
    handle: row.handle,
    fingerprint: row.fingerprint,
    label: row.label,
    relation: row.relation,
    isPrimary: row.isPrimary,
    priority: row.priority,
    status: row.status,
    allowsCall: row.allowsCall,
    allowsSms: row.allowsSms,
    allowsWhatsapp: row.allowsWhatsapp,
    allowsSocial: row.allowsSocial,
    thirdPartyAuthorized: row.thirdPartyAuthorized,
    consentedAt: row.consentedAt?.toISOString() ?? null,
    lastValidatedAt: row.lastValidatedAt?.toISOString() ?? null,
  };
}

type Tx = Parameters<Parameters<PrismaService['client']['$transaction']>[0]>[0];

/**
 * Aplica a redistribuicao de principal.
 *
 * Desmarca antes de marcar, sempre: o indice unico parcial do banco recusa dois
 * principais simultaneos, e a ordem inversa falharia no meio da transacao.
 */
async function applyPrimaries(tx: Tx, primaries: readonly PrimaryAssignment[]): Promise<void> {
  const toClear = primaries.filter((item) => !item.isPrimary).map((item) => item.id);
  if (toClear.length > 0) {
    await tx.contactPoint.updateMany({
      where: { id: { in: toClear } },
      data: { isPrimary: false },
    });
  }

  const toSet = primaries.filter((item) => item.isPrimary).map((item) => item.id);
  if (toSet.length > 0) {
    await tx.contactPoint.updateMany({ where: { id: { in: toSet } }, data: { isPrimary: true } });
  }
}

@Injectable()
export class PrismaContactRepository implements ContactRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listByApplication(applicationId: string): Promise<ContactRecord[]> {
    const rows = await this.prisma.client.contactPoint.findMany({
      where: { applicationId },
      orderBy: [{ channel: 'asc' }, { priority: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async create(
    applicationId: string,
    input: CreateContactRecord,
    context: WriteContext,
  ): Promise<ContactRecord> {
    return this.prisma.client.$transaction(async (tx) => {
      const application = await tx.application.findUnique({
        where: { id: applicationId },
        select: { id: true },
      });
      if (!application) throw new UnknownApplicationError(applicationId);

      const created = await tx.contactPoint.create({
        data: {
          applicationId,
          channel: input.channel,
          e164: input.e164 ?? null,
          platform: input.platform ?? null,
          handle: input.handle ?? null,
          fingerprint: input.fingerprint,
          label: input.label ?? null,
          relation: input.relation,
          priority: input.priority,
          allowsCall: input.allowsCall,
          allowsSms: input.allowsSms,
          allowsWhatsapp: input.allowsWhatsapp,
          allowsSocial: input.allowsSocial,
          thirdPartyAuthorized: input.thirdPartyAuthorized,
          consentedAt: input.consentedAt ?? null,
        },
      });

      await this.audit.record(
        {
          ...context,
          action: 'CONTACT_CREATE',
          entity: 'ContactPoint',
          entityId: created.id,
          metadata: {
            applicationId,
            channel: input.channel,
            relation: input.relation,
            platform: input.platform,
            // Redigidos pelo AuditService; ficam so como marcadores de presenca.
            phone: input.e164,
            handle: input.handle,
          },
        },
        tx,
      );

      return toRecord(created);
    });
  }

  async remove(
    applicationId: string,
    contactId: string,
    primaries: readonly PrimaryAssignment[],
    context: WriteContext,
  ): Promise<boolean> {
    return this.prisma.client.$transaction(async (tx) => {
      const { count } = await tx.contactPoint.deleteMany({
        where: { id: contactId, applicationId },
      });
      if (count === 0) return false;

      await applyPrimaries(tx, primaries);
      await this.audit.record(
        {
          ...context,
          action: 'CONTACT_REMOVE',
          entity: 'ContactPoint',
          entityId: contactId,
          metadata: { applicationId },
        },
        tx,
      );
      return true;
    });
  }

  async setPrimaries(
    applicationId: string,
    primaries: readonly PrimaryAssignment[],
    context: WriteContext,
  ): Promise<void> {
    await this.prisma.client.$transaction(async (tx) => {
      await applyPrimaries(tx, primaries);
      const principal = primaries.find((item) => item.isPrimary);
      await this.audit.record(
        {
          ...context,
          action: 'CONTACT_SET_PRIMARY',
          entity: 'ContactPoint',
          entityId: principal?.id ?? applicationId,
          metadata: { applicationId },
        },
        tx,
      );
    });
  }

  async startVerification(
    applicationId: string,
    contactId: string,
    challenge: OtpChallenge,
    context: WriteContext,
  ): Promise<boolean> {
    return this.prisma.client.$transaction(async (tx) => {
      const { count } = await tx.contactPoint.updateMany({
        where: { id: contactId, applicationId },
        data: {
          otpHash: challenge.otpHash,
          otpExpiresAt: challenge.expiresAt,
          otpAttempts: 0,
          status: 'PENDING_VERIFICATION',
        },
      });
      if (count === 0) return false;

      await this.audit.record(
        {
          ...context,
          action: 'CONTACT_VERIFICATION_START',
          entity: 'ContactPoint',
          entityId: contactId,
          metadata: { applicationId },
        },
        tx,
      );
      return true;
    });
  }

  async findChallenge(
    applicationId: string,
    contactId: string,
  ): Promise<{ otpHash: string | null; expiresAt: Date | null; attempts: number } | null> {
    const row = await this.prisma.client.contactPoint.findFirst({
      where: { id: contactId, applicationId },
      select: { otpHash: true, otpExpiresAt: true, otpAttempts: true },
    });
    if (!row) return null;
    return { otpHash: row.otpHash, expiresAt: row.otpExpiresAt, attempts: row.otpAttempts };
  }

  async completeVerification(
    applicationId: string,
    contactId: string,
    outcome: { status: ContactStatus; attempts: number; validatedAt?: Date },
    context: WriteContext,
  ): Promise<ContactRecord | null> {
    return this.prisma.client.$transaction(async (tx) => {
      const { count } = await tx.contactPoint.updateMany({
        where: { id: contactId, applicationId },
        data: {
          status: outcome.status,
          otpAttempts: outcome.attempts,
          // Verificado ou esgotado, o desafio deixa de existir: um hash de OTP
          // guardado depois de usado so aumenta a superficie (PRD 13.4).
          ...(outcome.status === 'VERIFIED' || outcome.attempts >= MAX_OTP_ATTEMPTS
            ? { otpHash: null, otpExpiresAt: null }
            : {}),
          ...(outcome.validatedAt ? { lastValidatedAt: outcome.validatedAt } : {}),
        },
      });
      if (count === 0) return null;

      await this.audit.record(
        {
          ...context,
          action: 'CONTACT_VERIFICATION_COMPLETE',
          entity: 'ContactPoint',
          entityId: contactId,
          metadata: { applicationId, status: outcome.status },
        },
        tx,
      );

      const row = await tx.contactPoint.findUniqueOrThrow({ where: { id: contactId } });
      return toRecord(row);
    });
  }
}

/** Tentativas antes de o desafio ser descartado. */
export const MAX_OTP_ATTEMPTS = 5;
