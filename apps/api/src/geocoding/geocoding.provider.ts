/**
 * Porta de geocodificacao (B-03).
 *
 * PRD 21 registra que o provider de producao ainda nao foi escolhido. A porta
 * existe para que essa escolha, quando vier, fique restrita a uma linha de
 * `provide` no modulo — como aconteceu com o repositorio na Fase 2 (ADR-0013).
 *
 * Nenhum adapter real e usado no MVP: PRD 1.2 proibe passar dado simulado por
 * oficial, e por isso o resultado carrega sempre a incerteza declarada.
 */

export interface GeocodeResolved {
  readonly status: 'RESOLVIDO';
  readonly latitude: number;
  readonly longitude: number;
  /** Raio de incerteza em quilometros. Nunca omitido: a estimativa e rotulada. */
  readonly precisionKm: number;
  readonly neighborhood: string | null;
}

export interface GeocodeFailed {
  readonly status: 'FALHOU';
  /**
   * Codigo estavel para a interface escolher a mensagem. Falhar nao e erro: PRD
   * 8.2 exige que a familia siga por bairro ou busca textual.
   */
  readonly reason: 'SETOR_DESCONHECIDO';
}

export type GeocodeResult = GeocodeResolved | GeocodeFailed;

export interface GeocodingProvider {
  geocode(cep: string): Promise<GeocodeResult>;
  /** Bairros conhecidos, para o fallback textual de PRD 8.2. */
  listNeighborhoods(): readonly string[];
}

export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
