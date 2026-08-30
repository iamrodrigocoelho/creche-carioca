import { cepSector } from '@match/domain';

import reference from './cep-sectors.json';

/**
 * Referencia de setores de CEP e a regra de precisao (ADR-0023, ADR-0024).
 *
 * Vive num pacote proprio porque duas execucoes diferentes precisam do MESMO
 * resultado: o adapter de geocodificacao da API e o build estatico, que resolve
 * o CEP inteiramente no navegador, sem servidor. Se as duas implementacoes
 * divergissem, a mesma familia veria unidades diferentes conforme a versao que
 * abrisse — e a divergencia so apareceria em producao.
 *
 * O arquivo de dados e gerado por
 * `pnpm --filter @match/data-pipeline cep-reference` e versionado: nem o CI nem
 * o build estatico tem acesso aos datasets da SME.
 */

export interface CepSector {
  readonly lat: number;
  readonly lon: number;
  readonly bairro: string | null;
  /** Unidades escolares que ancoram o setor. Uma so significa evidencia fraca. */
  readonly unidades: number;
  /** Maior distancia entre uma unidade do setor e o centroide, em quilometros. */
  readonly raioKm: number;
}

export interface SectorMatch {
  readonly lat: number;
  readonly lon: number;
  readonly bairro: string | null;
  /** Raio de incerteza declarado, em quilometros. Nunca menor que o piso. */
  readonly precisionKm: number;
}

const SECTORS = reference.sectors as Record<string, CepSector>;

/** Bairros conhecidos, em ordem, para a busca textual de PRD 8.2. */
export const NEIGHBORHOODS: readonly string[] = Object.freeze([...reference.neighborhoods]);

/** Versao da importacao que gerou a referencia, para rastreabilidade. */
export const REFERENCE_IMPORT_VERSION: string = reference.importVersion;

/**
 * Piso de incerteza. O centroide das unidades de um setor aproxima o setor, nao
 * o endereco da familia; declarar precisao melhor que isso seria fingir.
 */
export const MIN_PRECISION_KM = 0.5;

/**
 * Incerteza atribuida a setores com uma unica unidade de referencia.
 *
 * O raio medido nesses setores e sempre zero — um ponto nao tem dispersao — o
 * que superestimaria a precisao justamente onde a evidencia e mais fraca. Usa-se
 * o percentil 90 dos setores com mais de uma unidade, derivado dos proprios
 * dados em vez de arbitrado.
 */
export const SINGLE_UNIT_PRECISION_KM = percentile90(
  Object.values(SECTORS)
    .filter((sector) => sector.unidades > 1)
    .map((sector) => sector.raioKm),
);

export function precisionFor(sector: CepSector): number {
  const measured = sector.unidades > 1 ? sector.raioKm : SINGLE_UNIT_PRECISION_KM;
  return Math.max(measured, MIN_PRECISION_KM);
}

/**
 * Resolve um CEP ja normalizado. `null` quando o setor e desconhecido — falhar e
 * um resultado legitimo, e PRD 8.2 exige o caminho por bairro para esse caso.
 */
export function resolveCepSector(cep: string): SectorMatch | null {
  const sector = SECTORS[cepSector(cep)];
  if (sector === undefined) return null;

  return {
    lat: sector.lat,
    lon: sector.lon,
    bairro: sector.bairro,
    precisionKm: precisionFor(sector),
  };
}

/** Exposto para teste e diagnostico; nao usar para resolver CEP. */
export function allSectors(): Readonly<Record<string, CepSector>> {
  return SECTORS;
}

/**
 * Percentil 90, exportado para teste.
 *
 * As bordas — lista vazia, lista de um elemento — nao acontecem com a referencia
 * real, e por isso so sao alcancaveis por teste direto. Existem porque a
 * referencia e regerada a partir dos datasets, e uma importacao degenerada nao
 * deveria produzir `undefined` como incerteza.
 */
export function percentile90(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  // Com a lista vazia o indice vira -1, e o piso responde pelo caso: um unico
  // caminho de guarda em vez de dois, e alcancavel por teste.
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  return sorted[index] ?? MIN_PRECISION_KM;
}
