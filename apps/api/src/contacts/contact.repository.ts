import type { ContactChannel, ContactRelation, ContactStatus, SocialPlatform } from '@match/domain';

import type { WriteContext } from '../common/write-context';

/**
 * Porta de persistencia dos contatos (RF-03, RF-04).
 *
 * O registro carrega o valor completo porque a camada de aplicacao precisa dele
 * para mascarar e para recalcular o indice. Nada acima desta porta devolve o
 * valor completo para fora da API (PRD 13.4).
 */
export interface ContactRecord {
  readonly id: string;
  readonly channel: ContactChannel;
  readonly e164: string | null;
  readonly platform: SocialPlatform | null;
  readonly handle: string | null;
  readonly fingerprint: string;
  readonly label: string | null;
  readonly relation: ContactRelation;
  readonly isPrimary: boolean;
  readonly priority: number;
  readonly status: ContactStatus;
  readonly allowsCall: boolean;
  readonly allowsSms: boolean;
  readonly allowsWhatsapp: boolean;
  readonly allowsSocial: boolean;
  readonly thirdPartyAuthorized: boolean;
  readonly consentedAt: string | null;
  readonly lastValidatedAt: string | null;
}

export interface CreateContactRecord {
  readonly channel: ContactChannel;
  readonly e164?: string;
  readonly platform?: SocialPlatform;
  readonly handle?: string;
  readonly fingerprint: string;
  readonly label?: string;
  readonly relation: ContactRelation;
  readonly priority: number;
  readonly allowsCall: boolean;
  readonly allowsSms: boolean;
  readonly allowsWhatsapp: boolean;
  readonly allowsSocial: boolean;
  readonly thirdPartyAuthorized: boolean;
  readonly consentedAt?: Date;
}

/** Novo estado de principal, calculado pelo dominio e aplicado em bloco. */
export interface PrimaryAssignment {
  readonly id: string;
  readonly isPrimary: boolean;
}

export interface OtpChallenge {
  readonly otpHash: string;
  readonly expiresAt: Date;
}

export interface ContactRepository {
  listByApplication(applicationId: string): Promise<ContactRecord[]>;
  /**
   * Cria o contato sempre como nao-principal. Quem decide o principal e
   * `reconcilePrimary`, no dominio, e ele precisa do id real — que so existe
   * depois do insert. `setPrimaries` fecha a operacao.
   */
  create(
    applicationId: string,
    input: CreateContactRecord,
    context: WriteContext,
  ): Promise<ContactRecord>;
  remove(
    applicationId: string,
    contactId: string,
    primaries: readonly PrimaryAssignment[],
    context: WriteContext,
  ): Promise<boolean>;
  setPrimaries(
    applicationId: string,
    primaries: readonly PrimaryAssignment[],
    context: WriteContext,
  ): Promise<void>;
  startVerification(
    applicationId: string,
    contactId: string,
    challenge: OtpChallenge,
    context: WriteContext,
  ): Promise<boolean>;
  /** Devolve o desafio guardado, para o servico conferir o codigo. */
  findChallenge(
    applicationId: string,
    contactId: string,
  ): Promise<{ otpHash: string | null; expiresAt: Date | null; attempts: number } | null>;
  completeVerification(
    applicationId: string,
    contactId: string,
    outcome: { status: ContactStatus; attempts: number; validatedAt?: Date },
    context: WriteContext,
  ): Promise<ContactRecord | null>;
}

export const CONTACT_REPOSITORY = Symbol('CONTACT_REPOSITORY');

export class UnknownApplicationError extends Error {
  constructor(public readonly applicationId: string) {
    super('Inscricao nao encontrada.');
    this.name = 'UnknownApplicationError';
  }
}
