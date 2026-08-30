import type { ChildInput, Sex } from '@match/schemas';
import type { Shift } from '@match/domain';

/**
 * Porta de persistencia da inscricao.
 *
 * ADR-0003: na Fase 1 o adapter e em memoria; na Fase 2 um adapter Prisma/PostgreSQL
 * assume a mesma interface sem alterar dominio nem controllers.
 *
 * O registro guarda apenas as ENTRADAS. O grupamento etario e sempre recalculado
 * na leitura, o que satisfaz o criterio do PRD 8.1 de recalculo ao alterar
 * nascimento ou data de referencia, sem risco de valor derivado desatualizado.
 */
export interface ApplicationRecord {
  readonly id: string;
  readonly anonymousChildId: string;
  readonly status: 'RASCUNHO';
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

export type ApplicationChildInput = ChildInput;

export interface ApplicationRepository {
  create(record: ApplicationRecord): Promise<ApplicationRecord>;
  findById(id: string): Promise<ApplicationRecord | null>;
  update(record: ApplicationRecord): Promise<ApplicationRecord>;
}

export const APPLICATION_REPOSITORY = Symbol('APPLICATION_REPOSITORY');
