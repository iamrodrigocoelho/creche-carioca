import { createHash, randomInt } from 'node:crypto';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  canRemoveContact,
  flagDuplicateContacts,
  hasReachableContact,
  maskHandle,
  maskPhone,
  reconcilePrimary,
  type ContactRuleViolation,
  type ContactSummary,
} from '@match/domain';
import type {
  ContactChallengeResponse,
  ContactListResponse,
  CreatePhoneContactParsed,
  CreateSocialContactParsed,
  VerifyContactInput,
} from '@match/schemas';

import { CLOCK, type Clock } from '../common/clock';
import { currentCorrelationId } from '../common/logging/correlation';
import { ANONYMOUS_ACTOR, type WriteContext } from '../common/write-context';
import {
  CONTACT_REPOSITORY,
  UnknownApplicationError,
  type ContactRecord,
  type ContactRepository,
} from './contact.repository';
import { ContactFingerprintService } from './contact-fingerprint.service';
import { MAX_OTP_ATTEMPTS } from './prisma-contact.repository';

/**
 * Casos de uso dos contatos (RF-03, RF-04).
 *
 * As invariantes vem do dominio; aqui elas sao orquestradas contra o
 * repositorio. Duas merecem destaque porque nao sao obvias:
 *
 * - **Exatamente um principal** e reconciliado a cada escrita, e nao validado.
 *   Marcar um novo principal precisa desmarcar o anterior, e remover o principal
 *   precisa promover outro; exigir que o cliente acerte isso produziria estados
 *   invalidos sem que ninguem tivesse errado.
 * - **Rede social nunca e o unico contato** (PRD 8.4) e informado na leitura,
 *   via `hasReachableContact`, para a interface poder dizer o que falta em vez
 *   de so recusar no fim.
 */

/** Validade do desafio simulado. Curta o bastante para nao virar senha. */
const OTP_TTL_MINUTES = 10;

@Injectable()
export class ContactsService {
  constructor(
    @Inject(CONTACT_REPOSITORY)
    private readonly repository: ContactRepository,
    private readonly fingerprints: ContactFingerprintService,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async list(applicationId: string): Promise<ContactListResponse> {
    return this.toListResponse(
      applicationId,
      await this.repository.listByApplication(applicationId),
    );
  }

  async addPhone(
    applicationId: string,
    input: CreatePhoneContactParsed,
  ): Promise<ContactListResponse> {
    const existing = await this.repository.listByApplication(applicationId);
    const fingerprint = this.fingerprints.compute('TELEFONE', input.phone);

    const created = await this.write(() =>
      this.repository.create(
        applicationId,
        {
          channel: 'TELEFONE',
          e164: input.phone,
          fingerprint,
          ...(input.label ? { label: input.label } : {}),
          relation: input.relation,
          priority: input.priority ?? existing.length + 1,
          allowsCall: input.allowsCall,
          allowsSms: input.allowsSms,
          allowsWhatsapp: input.allowsWhatsapp,
          allowsSocial: false,
          thirdPartyAuthorized: input.thirdPartyAuthorized,
          consentedAt: this.clock(),
        },
        this.writeContext(),
      ),
    );

    // O contato nasce sem ser principal; `reconcilePrimary` decide com a lista
    // ja completa. Sem indicacao explicita, o primeiro telefone assume.
    await this.repository.setPrimaries(
      applicationId,
      reconcilePrimary(
        toSummaries(await this.repository.listByApplication(applicationId)),
        input.isPrimary ? created.id : undefined,
      ),
      this.writeContext(),
    );

    return this.list(applicationId);
  }

  async addSocial(
    applicationId: string,
    input: CreateSocialContactParsed,
  ): Promise<ContactListResponse> {
    const existing = await this.repository.listByApplication(applicationId);

    await this.write(() =>
      this.repository.create(
        applicationId,
        {
          channel: 'SOCIAL',
          platform: input.platform,
          handle: input.handle,
          fingerprint: this.fingerprints.compute(`SOCIAL:${input.platform}`, input.handle),
          ...(input.label ? { label: input.label } : {}),
          // Perfil social nao tem relacao com a crianca no sentido de PRD 8.3;
          // o campo existe na tabela unificada e recebe o valor neutro.
          relation: 'RESPONSAVEL',
          priority: input.priority ?? existing.length + 1,
          allowsCall: false,
          allowsSms: false,
          allowsWhatsapp: false,
          allowsSocial: input.allowsSocial,
          thirdPartyAuthorized: false,
          // PRD 8.4 exige data de autorizacao quando ha autorizacao.
          ...(input.allowsSocial ? { consentedAt: this.clock() } : {}),
        },
        this.writeContext(),
      ),
    );

    return this.list(applicationId);
  }

  async remove(applicationId: string, contactId: string): Promise<ContactListResponse> {
    const existing = await this.repository.listByApplication(applicationId);
    const decision = canRemoveContact(toSummaries(existing), contactId);
    if (!decision.ok) throw ruleViolation(decision.violation);

    const remaining = existing.filter((contact) => contact.id !== contactId);
    const removed = await this.repository.remove(
      applicationId,
      contactId,
      reconcilePrimary(toSummaries(remaining)),
      this.writeContext(),
    );
    if (!removed) throw contactNotFound();

    return this.list(applicationId);
  }

  async setPrimary(applicationId: string, contactId: string): Promise<ContactListResponse> {
    const existing = await this.repository.listByApplication(applicationId);
    const target = existing.find((contact) => contact.id === contactId);
    if (!target) throw contactNotFound();
    if (target.channel !== 'TELEFONE') throw ruleViolation('PRIMARY_MUST_BE_PHONE');

    await this.repository.setPrimaries(
      applicationId,
      reconcilePrimary(toSummaries(existing), contactId),
      this.writeContext(),
    );

    return this.list(applicationId);
  }

  /**
   * Abre o desafio de verificacao (PRD 8.3, simulado).
   *
   * Nao ha envio de SMS nesta demonstracao (B-06), entao o codigo volta no
   * corpo da resposta — mandar a familia esperar uma mensagem que nunca chega
   * seria pior. O que se guarda e apenas o hash (PRD 13.4).
   */
  async startVerification(
    applicationId: string,
    contactId: string,
  ): Promise<ContactChallengeResponse> {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(this.clock().getTime() + OTP_TTL_MINUTES * 60_000);

    const started = await this.repository.startVerification(
      applicationId,
      contactId,
      { otpHash: hashCode(code), expiresAt },
      this.writeContext(),
    );
    if (!started) throw contactNotFound();

    return {
      contactId,
      expiresAt: expiresAt.toISOString(),
      simulatedCode: code,
      notice:
        'Verificação simulada: nenhuma mensagem foi enviada. Em produção, este código chegaria por SMS.',
    };
  }

  async confirmVerification(
    applicationId: string,
    contactId: string,
    input: VerifyContactInput,
  ): Promise<ContactListResponse> {
    const challenge = await this.repository.findChallenge(applicationId, contactId);
    if (!challenge) throw contactNotFound();

    if (challenge.otpHash === null || challenge.expiresAt === null) {
      throw new BadRequestException({
        code: 'VERIFICATION_NOT_STARTED',
        message: 'Peça um novo código para verificar este contato.',
      });
    }
    if (challenge.expiresAt.getTime() <= this.clock().getTime()) {
      await this.repository.completeVerification(
        applicationId,
        contactId,
        { status: 'INFORMED', attempts: MAX_OTP_ATTEMPTS },
        this.writeContext(),
      );
      throw new BadRequestException({
        code: 'VERIFICATION_EXPIRED',
        message: 'O código expirou. Peça um novo.',
      });
    }

    const attempts = challenge.attempts + 1;
    const correct = hashCode(input.code) === challenge.otpHash;

    await this.repository.completeVerification(
      applicationId,
      contactId,
      correct
        ? { status: 'VERIFIED', attempts, validatedAt: this.clock() }
        : { status: attempts >= MAX_OTP_ATTEMPTS ? 'INVALID' : 'PENDING_VERIFICATION', attempts },
      this.writeContext(),
    );

    if (!correct) {
      throw new BadRequestException({
        code: 'VERIFICATION_CODE_INVALID',
        message:
          attempts >= MAX_OTP_ATTEMPTS
            ? 'Código incorreto. Foram muitas tentativas; peça um novo código.'
            : 'Código incorreto. Confira e tente de novo.',
      });
    }

    return this.list(applicationId);
  }

  /**
   * Mascara e sinaliza duplicidade.
   *
   * O valor completo para de existir aqui: nada abaixo desta funcao chega ao
   * cliente (PRD 13.4). A duplicidade e comparada pelo indice cego, nunca pelo
   * valor (ADR-0027).
   */
  private toListResponse(
    applicationId: string,
    records: readonly ContactRecord[],
  ): ContactListResponse {
    const flagged = flagDuplicateContacts(records);

    return {
      applicationId,
      contacts: flagged.map((record) => ({
        id: record.id,
        channel: record.channel === 'SOCIAL' ? ('SOCIAL' as const) : ('TELEFONE' as const),
        masked: maskFor(record),
        platform: record.platform,
        label: record.label,
        relation: record.relation,
        isPrimary: record.isPrimary,
        priority: record.priority,
        status: record.status,
        allowsCall: record.allowsCall,
        allowsSms: record.allowsSms,
        allowsWhatsapp: record.allowsWhatsapp,
        allowsSocial: record.allowsSocial,
        thirdPartyAuthorized: record.thirdPartyAuthorized,
        duplicateOfId: record.duplicateOfId,
        consentedAt: record.consentedAt,
        lastValidatedAt: record.lastValidatedAt,
      })),
      hasReachableContact: hasReachableContact(toSummaries(records)),
    };
  }

  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof UnknownApplicationError) throw applicationNotFound();
      throw error;
    }
  }

  private writeContext(): WriteContext {
    return { correlationId: currentCorrelationId(), ...ANONYMOUS_ACTOR };
  }
}

function toSummaries(records: readonly ContactRecord[]): ContactSummary[] {
  return records.map((record) => ({
    id: record.id,
    channel: record.channel,
    isPrimary: record.isPrimary,
    fingerprint: record.fingerprint,
  }));
}

function maskFor(record: ContactRecord): string {
  if (record.channel === 'SOCIAL') return maskHandle(record.handle ?? '');
  return maskPhone(record.e164 ?? '');
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

const VIOLATION_MESSAGES: Readonly<Record<ContactRuleViolation, string>> = {
  PHONE_REQUIRED: 'Informe ao menos um telefone.',
  LAST_PHONE_CANNOT_BE_REMOVED:
    'Este é o único telefone da inscrição e não pode ser removido. Cadastre outro antes.',
  THIRD_PARTY_AUTHORIZATION_REQUIRED: 'Confirme que a pessoa autorizou o uso do telefone dela.',
  SOCIAL_CANNOT_BE_ONLY_CONTACT: 'Rede social não pode ser o único contato. Informe um telefone.',
  PRIMARY_MUST_BE_PHONE: 'Somente um telefone pode ser o contato principal.',
};

function ruleViolation(violation: ContactRuleViolation): BadRequestException {
  return new BadRequestException({ code: violation, message: VIOLATION_MESSAGES[violation] });
}

function applicationNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'APPLICATION_NOT_FOUND',
    message: 'Inscrição não encontrada.',
  });
}

function contactNotFound(): NotFoundException {
  return new NotFoundException({ code: 'CONTACT_NOT_FOUND', message: 'Contato não encontrado.' });
}
