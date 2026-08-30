import type { AnchorKind } from '../location-anchor';
import { estimateDistance, type Coordinate, type DistanceEstimate } from './distance';

/**
 * Ordenacao e explicacao das unidades recomendadas (PRD 8.5).
 *
 * Duas regras do PRD moldam tudo aqui:
 *
 * - **A recomendacao nao pode impedir a escolha livre.** Por isso nada e
 *   filtrado por proximidade: a ordem muda, o conjunto nao. Filtros explicitos
 *   (bairro, CRE, tipo) sao decisao da familia, e ai sim reduzem a lista.
 * - **O sistema deve explicar por que uma unidade foi recomendada**, a partir de
 *   dados estruturados. Cada unidade sai com os motivos que a colocaram onde
 *   esta, e nao com um texto pronto.
 */

export const DEMAND_LEVELS = ['BAIXA', 'MEDIA', 'ALTA', 'MUITO_ALTA'] as const;
export type DemandLevel = (typeof DEMAND_LEVELS)[number];

export interface RecommendableUnit {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: string | null;
  readonly neighborhood: string | null;
  readonly cre: number | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly historicalAgeGroups: readonly string[];
  readonly historicalShifts: readonly string[];
  readonly historicalApplications: number;
  readonly demandLevel: DemandLevel;
}

/**
 * Rotulos historicos que correspondem a cada faixa da politica (ADR-0035).
 *
 * As bases de 2021 a 2025 registram tres grupamentos — Berçário, Maternal I e
 * Maternal II — enquanto a politica de demonstracao tem quatro faixas, com o
 * berçario dividido em I e II. A divisao e da politica, nao da origem: uma
 * unidade que atendeu "Berçário" atendeu as duas faixas. O mapeamento afirma
 * isso, e nada alem disso.
 */
const HISTORICAL_AGE_GROUP_LABELS: Readonly<Record<string, readonly string[]>> = {
  BERCARIO_I: ['Berçário'],
  BERCARIO_II: ['Berçário'],
  MATERNAL_I: ['Maternal I'],
  MATERNAL_II: ['Maternal II'],
};

/** `true` quando a unidade ja atendeu a faixa em algum dos cinco processos. */
export function servedAgeGroup(unit: RecommendableUnit, ageGroupCode: string): boolean {
  const labels = HISTORICAL_AGE_GROUP_LABELS[ageGroupCode] ?? [];
  return labels.some((label) => unit.historicalAgeGroups.includes(label));
}

export interface RecommendationAnchor {
  readonly position: number;
  readonly kind: AnchorKind;
  readonly latitude: number;
  readonly longitude: number;
  readonly precisionKm: number | null;
  /** Bairro resolvido pela geocodificacao, quando houve. */
  readonly neighborhood: string | null;
}

export interface AnchorDistance {
  readonly anchorPosition: number;
  readonly anchorKind: AnchorKind;
  readonly distance: DistanceEstimate;
}

/** Motivo estruturado. A interface escolhe as palavras; aqui ficam os fatos. */
export interface RecommendationReason {
  readonly code:
    | 'PROXIMA_DA_RESIDENCIA'
    | 'PROXIMA_DE_OUTRO_PONTO'
    | 'MESMO_BAIRRO'
    | 'ATENDE_O_GRUPAMENTO'
    | 'ATENDE_O_TURNO'
    | 'DEMANDA_HISTORICA'
    | 'SEM_LOCALIZACAO';
  readonly values: Readonly<Record<string, string | number>>;
}

export interface RecommendedUnit {
  readonly unit: RecommendableUnit;
  readonly distances: readonly AnchorDistance[];
  /** Menor distancia entre todos os pontos. `null` sem coordenada conhecida. */
  readonly nearestKm: number | null;
  readonly reasons: readonly RecommendationReason[];
}

export interface RecommendationInput {
  readonly units: readonly RecommendableUnit[];
  readonly anchors: readonly RecommendationAnchor[];
  /** Codigo do grupamento resolvido, para marcar as unidades que ja o atenderam. */
  readonly ageGroupCode?: string | undefined;
  readonly shift?: string | undefined;
}

/** Distancia a partir da qual a unidade e sinalizada como distante (PRD 8.6). */
export const FAR_DISTANCE_KM = 5;

/** Ate onde uma unidade conta como "proxima" na explicacao. */
const NEAR_DISTANCE_KM = 2;

/**
 * Ordena por proximidade e explica.
 *
 * Unidades sem coordenada vao para o fim, nunca sao descartadas: 20 das 872 nao
 * tem localizacao conhecida (ADR-0023), e some-las da lista as tornaria
 * inescolhiveis por um defeito do dado, nao por decisao de ninguem.
 */
export function recommendUnits(input: RecommendationInput): RecommendedUnit[] {
  const residence = input.anchors.find((anchor) => anchor.kind === 'RESIDENCIA');

  const scored = input.units.map((unit) => {
    const distances = distancesFor(unit, input.anchors);
    const nearestKm =
      distances.length === 0 ? null : Math.min(...distances.map((d) => d.distance.km));

    return {
      unit,
      distances,
      nearestKm,
      reasons: reasonsFor(unit, distances, nearestKm, residence, input),
    };
  });

  return scored.sort(compareByProximity);
}

function distancesFor(
  unit: RecommendableUnit,
  anchors: readonly RecommendationAnchor[],
): AnchorDistance[] {
  if (unit.latitude === null || unit.longitude === null) return [];
  const target: Coordinate = { latitude: unit.latitude, longitude: unit.longitude };

  return anchors.map((anchor) => ({
    anchorPosition: anchor.position,
    anchorKind: anchor.kind,
    distance: estimateDistance(anchor, target),
  }));
}

function reasonsFor(
  unit: RecommendableUnit,
  distances: readonly AnchorDistance[],
  nearestKm: number | null,
  residence: RecommendationAnchor | undefined,
  input: RecommendationInput,
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];

  if (nearestKm === null) {
    reasons.push({ code: 'SEM_LOCALIZACAO', values: {} });
  } else {
    const nearest = distances.find((d) => d.distance.km === nearestKm);
    if (nearest !== undefined && nearestKm <= NEAR_DISTANCE_KM) {
      reasons.push({
        code:
          nearest.anchorKind === 'RESIDENCIA' ? 'PROXIMA_DA_RESIDENCIA' : 'PROXIMA_DE_OUTRO_PONTO',
        values: { km: nearestKm, ponto: nearest.anchorPosition },
      });
    }
  }

  if (
    residence?.neighborhood !== null &&
    residence?.neighborhood !== undefined &&
    unit.neighborhood !== null &&
    sameNeighborhood(residence.neighborhood, unit.neighborhood)
  ) {
    reasons.push({ code: 'MESMO_BAIRRO', values: { bairro: unit.neighborhood } });
  }

  if (input.ageGroupCode !== undefined && servedAgeGroup(unit, input.ageGroupCode)) {
    reasons.push({ code: 'ATENDE_O_GRUPAMENTO', values: { grupamento: input.ageGroupCode } });
  }
  if (input.shift !== undefined && unit.historicalShifts.includes(input.shift)) {
    reasons.push({ code: 'ATENDE_O_TURNO', values: { turno: input.shift } });
  }

  reasons.push({ code: 'DEMANDA_HISTORICA', values: { nivel: unit.demandLevel } });

  return reasons;
}

/**
 * Compara bairros vindos de fontes diferentes.
 *
 * O bairro da unidade vem do cadastro da SME e o do ponto de referencia vem da
 * referencia de CEP; acentuacao e caixa divergem entre eles.
 */
function sameNeighborhood(a: string, b: string): boolean {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toUpperCase();
  return normalize(a) === normalize(b);
}

/** Sem coordenada vai para o fim; empate desfeito pelo nome, para ser estavel. */
function compareByProximity(a: RecommendedUnit, b: RecommendedUnit): number {
  if (a.nearestKm === null && b.nearestKm === null)
    return a.unit.name.localeCompare(b.unit.name, 'pt-BR');
  if (a.nearestKm === null) return 1;
  if (b.nearestKm === null) return -1;
  if (a.nearestKm !== b.nearestKm) return a.nearestKm - b.nearestKm;
  return a.unit.name.localeCompare(b.unit.name, 'pt-BR');
}

/** Alerta informativo de PRD 8.6: destaca opcao distante, sem bloquear. */
export function isFarFromAllAnchors(recommended: RecommendedUnit): boolean {
  return recommended.nearestKm !== null && recommended.nearestKm > FAR_DISTANCE_KM;
}
