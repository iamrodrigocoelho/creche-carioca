import { Injectable } from '@nestjs/common';

import { cepSector } from '@match/domain';

import reference from './cep-sectors.json';
import type { GeocodingProvider, GeocodeResult } from './geocoding.provider';

/**
 * Adapter deterministico ancorado nos CEPs reais das unidades escolares
 * (ADR-0023).
 *
 * Para cada setor de CEP — os cinco primeiros digitos — a referencia guarda o
 * centroide das unidades daquele setor. Cobre 89% dos CEPs que aparecem nos
 * cinco processos historicos; o resto falha, e falhar e o comportamento certo:
 * PRD 8.2 exige um caminho por bairro para quando a geocodificacao nao resolve.
 *
 * Nao ha chamada de rede, nao ha relogio e nao ha aleatoriedade: o mesmo CEP
 * devolve sempre o mesmo ponto, o que torna a recomendacao da Fase 6 reproduzivel.
 */

interface Sector {
  readonly lat: number;
  readonly lon: number;
  readonly bairro: string | null;
  readonly unidades: number;
  readonly raioKm: number;
}

/**
 * Piso de incerteza. O centroide das unidades de um setor aproxima o setor, nao
 * o endereco da familia; declarar precisao melhor que isso seria fingir.
 */
export const MIN_PRECISION_KM = 0.5;

@Injectable()
export class CepSectorGeocodingProvider implements GeocodingProvider {
  private readonly sectors = reference.sectors as Record<string, Sector>;
  private readonly neighborhoods = Object.freeze([...reference.neighborhoods]);
  /**
   * Incerteza atribuida a setores com uma unica unidade de referencia. O raio
   * medido nesses setores e sempre zero — um ponto nao tem dispersao — o que
   * superestimaria a precisao. Usa-se o percentil 90 dos setores que tem mais de
   * uma unidade, derivado dos proprios dados em vez de chutado.
   */
  private readonly singleUnitPrecisionKm = percentile90(
    Object.values(this.sectors)
      .filter((sector) => sector.unidades > 1)
      .map((sector) => sector.raioKm),
  );

  async geocode(cep: string): Promise<GeocodeResult> {
    const sector = this.sectors[cepSector(cep)];
    if (sector === undefined) {
      return { status: 'FALHOU', reason: 'SETOR_DESCONHECIDO' };
    }

    return {
      status: 'RESOLVIDO',
      latitude: sector.lat,
      longitude: sector.lon,
      precisionKm: this.precisionFor(sector),
      neighborhood: sector.bairro,
    };
  }

  listNeighborhoods(): readonly string[] {
    return this.neighborhoods;
  }

  private precisionFor(sector: Sector): number {
    const measured = sector.unidades > 1 ? sector.raioKm : this.singleUnitPrecisionKm;
    return Math.max(measured, MIN_PRECISION_KM);
  }
}

function percentile90(values: readonly number[]): number {
  if (values.length === 0) return MIN_PRECISION_KM;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));
  return sorted[index] ?? MIN_PRECISION_KM;
}
