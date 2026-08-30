import type { AnchorKind, GeocodingStatus } from '@match/schemas';

import type { WriteContext } from '../common/write-context';

/**
 * Porta de persistencia dos pontos de referencia (RF-02).
 *
 * Guarda o resultado da geocodificacao, nao a forma de obte-lo: trocar o
 * provider simulado por um real (B-03) nao toca esta interface.
 */
export interface LocationAnchorRecord {
  readonly id: string;
  readonly position: number;
  readonly kind: AnchorKind;
  readonly cep: string;
  readonly label: string | null;
  readonly status: GeocodingStatus;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly precisionKm: number | null;
  readonly neighborhood: string | null;
  readonly lastValidatedAt: string | null;
}

export interface UpsertLocationAnchorRecord {
  readonly position: number;
  readonly kind: AnchorKind;
  readonly cep: string;
  readonly label?: string;
  readonly status: GeocodingStatus;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly precisionKm?: number;
  readonly neighborhood?: string;
  readonly lastValidatedAt: Date;
}

export interface LocationAnchorRepository {
  listByApplication(applicationId: string): Promise<LocationAnchorRecord[]>;
  upsert(
    applicationId: string,
    input: UpsertLocationAnchorRecord,
    context: WriteContext,
  ): Promise<LocationAnchorRecord>;
  /** `false` quando nao havia ponto naquela posicao. */
  remove(applicationId: string, position: number, context: WriteContext): Promise<boolean>;
}

export const LOCATION_ANCHOR_REPOSITORY = Symbol('LOCATION_ANCHOR_REPOSITORY');

/** Lancada quando a inscricao referenciada nao existe. */
export class UnknownApplicationError extends Error {
  constructor(public readonly applicationId: string) {
    super('Inscricao nao encontrada.');
    this.name = 'UnknownApplicationError';
  }
}
