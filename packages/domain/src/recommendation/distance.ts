/**
 * Distancia geodesica (PRD 8.5, B-04).
 *
 * PRD 21 deixa em aberto se a producao usara rota viaria. Ate la, a distancia e
 * a de Haversine — a linha reta sobre a esfera — e **toda distancia estimada
 * deve ser identificada como estimativa** (PRD 8.5). Por isso o resultado nunca
 * e um numero solto: vem acompanhado do metodo e da incerteza herdada da
 * geocodificacao.
 *
 * Nao ha conversao para tempo de percurso, e nao havera: PRD 8.5 proibe
 * inventar tempos.
 */

/** Raio medio da Terra em quilometros. */
const EARTH_RADIUS_KM = 6371;

export interface Coordinate {
  readonly latitude: number;
  readonly longitude: number;
}

export interface DistanceEstimate {
  readonly km: number;
  /** Sempre `GEODESICA` no MVP. O campo existe para a troca de B-04 ser visivel. */
  readonly method: 'GEODESICA';
  /**
   * Incerteza herdada do ponto de referencia, em quilometros. A geocodificacao
   * resolve no nivel do setor de CEP (ADR-0023/0024), entao a distancia nao
   * pode ser mais precisa que o ponto de partida.
   */
  readonly precisionKm: number | null;
}

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Haversine. Devolve quilometros, sem arredondar. */
export function haversineKm(from: Coordinate, to: Coordinate): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Estimativa arredondada para exibicao.
 *
 * Uma casa decimal: com incerteza de centenas de metros no ponto de partida,
 * publicar metros seria precisao falsa.
 */
export function estimateDistance(
  from: Coordinate & { readonly precisionKm?: number | null },
  to: Coordinate,
): DistanceEstimate {
  return {
    km: Math.round(haversineKm(from, to) * 10) / 10,
    method: 'GEODESICA',
    precisionKm: from.precisionKm ?? null,
  };
}
