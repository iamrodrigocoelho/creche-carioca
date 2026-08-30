import type { Shift } from '@match/domain';
import type { Sex } from '@match/schemas';

/**
 * Porta de persistencia da inscricao.
 *
 * ADR-0003 previa a troca do adapter em memoria por Prisma/PostgreSQL na Fase 2;
 * ADR-0013 registra a conclusao dessa troca. O dominio continua intocado: nada
 * aqui conhece Prisma, e o servico de aplicacao continua falando apenas com esta
 * interface.
 *
 * O registro guarda apenas as ENTRADAS. O grupamento etario e sempre recalculado
 * na leitura (ADR-0012), o que satisfaz o criterio do PRD 8.1 de recalculo ao
 * alterar nascimento ou data de referencia.
 */
export interface ApplicationRecord {
  readonly id: string;
  readonly anonymousChildId: string;
  readonly status: 'RASCUNHO';
  /** Codigo publico do processo, ex.: `DEMO-2026`. Nunca o UUID interno. */
  readonly processId: string;
  readonly birthYear: number;
  readonly birthMonth: number;
  readonly sex?: Sex;
  readonly desiredShift: Shift;
  /** Sobrescreve a data de corte da regra quando informado. */
  readonly referenceDate?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateApplicationRecord {
  readonly processId: string;
  readonly birthYear: number;
  readonly birthMonth: number;
  readonly sex?: Sex;
  readonly desiredShift: Shift;
  readonly referenceDate?: string;
}

export interface UpdateApplicationRecord {
  readonly birthYear?: number;
  readonly birthMonth?: number;
  readonly sex?: Sex;
  readonly desiredShift?: Shift;
  readonly referenceDate?: string;
}

/**
 * Contexto de rastreabilidade propagado ate a escrita.
 *
 * PRD 8.16 exige ator, papel, correlation ID e origem em todo evento relevante.
 * Carregar isso explicitamente evita que a camada de persistencia precise
 * adivinhar quem originou a operacao.
 */
export interface WriteContext {
  readonly correlationId: string;
  readonly actor: string;
  readonly actorRole: string;
}

export interface ApplicationRepository {
  create(input: CreateApplicationRecord, context: WriteContext): Promise<ApplicationRecord>;
  findById(id: string): Promise<ApplicationRecord | null>;
  update(
    id: string,
    patch: UpdateApplicationRecord,
    context: WriteContext,
  ): Promise<ApplicationRecord | null>;
}

export const APPLICATION_REPOSITORY = Symbol('APPLICATION_REPOSITORY');

/** Lancada quando o processo referenciado nao existe no banco. */
export class UnknownProcessError extends Error {
  constructor(public readonly processCode: string) {
    super('Processo seletivo nao encontrado.');
    this.name = 'UnknownProcessError';
  }
}
