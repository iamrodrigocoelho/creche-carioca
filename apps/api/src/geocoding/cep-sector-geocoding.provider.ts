import { Injectable } from '@nestjs/common';

import { NEIGHBORHOODS, resolveCepSector } from '@match/geo';

import type { GeocodeResult, GeocodingProvider } from './geocoding.provider';

/**
 * Adapter deterministico ancorado nos CEPs reais das unidades escolares
 * (ADR-0023).
 *
 * A regra em si vive em `@match/geo`, e nao aqui: o build estatico resolve o
 * mesmo CEP no navegador, sem servidor, e precisa chegar ao mesmo ponto
 * (ADR-0027). Este arquivo so adapta o resultado ao contrato da porta.
 *
 * Nao ha chamada de rede, nao ha relogio e nao ha aleatoriedade: o mesmo CEP
 * devolve sempre o mesmo ponto, o que torna a recomendacao da Fase 6
 * reproduzivel.
 */
@Injectable()
export class CepSectorGeocodingProvider implements GeocodingProvider {
  async geocode(cep: string): Promise<GeocodeResult> {
    const sector = resolveCepSector(cep);
    if (sector === null) {
      return { status: 'FALHOU', reason: 'SETOR_DESCONHECIDO' };
    }

    return {
      status: 'RESOLVIDO',
      latitude: sector.lat,
      longitude: sector.lon,
      precisionKm: sector.precisionKm,
      neighborhood: sector.bairro,
    };
  }

  listNeighborhoods(): readonly string[] {
    return NEIGHBORHOODS;
  }
}
