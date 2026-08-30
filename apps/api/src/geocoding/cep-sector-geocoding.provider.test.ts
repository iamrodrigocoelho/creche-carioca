import { describe, expect, it } from 'vitest';

import { CepSectorGeocodingProvider, MIN_PRECISION_KM } from './cep-sector-geocoding.provider';
import reference from './cep-sectors.json';

/**
 * O provider e ancorado numa referencia versionada, entao os testes leem a
 * propria referencia para escolher os casos. Fixar um CEP no codigo quebraria a
 * suite toda vez que a referencia fosse regerada, sem que nada estivesse errado.
 */
const sectors = Object.entries(reference.sectors);
const multiUnit = sectors.find(([, sector]) => sector.unidades > 1);
const singleUnit = sectors.find(([, sector]) => sector.unidades === 1);

describe('CepSectorGeocodingProvider', () => {
  const provider = new CepSectorGeocodingProvider();

  it('resolve um CEP cujo setor esta na referencia', async () => {
    const [sectorCode, sector] = multiUnit ?? [];
    if (sectorCode === undefined || sector === undefined) throw new Error('referência sem setor');

    const result = await provider.geocode(`${sectorCode}000`);
    expect(result).toMatchObject({
      status: 'RESOLVIDO',
      latitude: sector.lat,
      longitude: sector.lon,
      neighborhood: sector.bairro,
    });
  });

  it('falha sem inventar coordenada quando o setor e desconhecido', async () => {
    // 99999 nao e um setor de CEP do municipio do Rio.
    const result = await provider.geocode('99999000');
    expect(result).toEqual({ status: 'FALHOU', reason: 'SETOR_DESCONHECIDO' });
  });

  it('e deterministico: o mesmo CEP devolve sempre o mesmo ponto', async () => {
    const [sectorCode] = multiUnit ?? [];
    if (sectorCode === undefined) throw new Error('referência sem setor');

    const primeira = await provider.geocode(`${sectorCode}123`);
    const segunda = await provider.geocode(`${sectorCode}999`);
    expect(primeira).toEqual(segunda);
  });

  it('ignora a formatacao: so os cinco primeiros digitos importam', async () => {
    const [sectorCode] = multiUnit ?? [];
    if (sectorCode === undefined) throw new Error('referência sem setor');

    expect(await provider.geocode(`${sectorCode}001`)).toEqual(
      await provider.geocode(`${sectorCode}002`),
    );
  });

  describe('incerteza declarada', () => {
    it('nunca afirma precisao melhor que o piso', async () => {
      for (const [sectorCode] of sectors) {
        const result = await provider.geocode(`${sectorCode}000`);
        if (result.status !== 'RESOLVIDO') continue;
        expect(result.precisionKm).toBeGreaterThanOrEqual(MIN_PRECISION_KM);
      }
    });

    /**
     * Um setor com uma unica unidade tem raio medido igual a zero — um ponto nao
     * tem dispersao. Reportar isso como precisao perfeita seria o pior tipo de
     * erro: uma estimativa ruim se passando por exata.
     */
    it('nao trata setor de uma unidade so como preciso', async () => {
      const [sectorCode, sector] = singleUnit ?? [];
      if (sectorCode === undefined || sector === undefined) return;

      expect(sector.raioKm).toBe(0);
      const result = await provider.geocode(`${sectorCode}000`);
      if (result.status !== 'RESOLVIDO') throw new Error('esperava RESOLVIDO');
      expect(result.precisionKm).toBeGreaterThan(MIN_PRECISION_KM);
    });
  });

  it('lista os bairros usados no fallback de PRD 8.2', () => {
    const bairros = provider.listNeighborhoods();
    expect(bairros.length).toBeGreaterThan(100);
    expect([...bairros]).toEqual([...bairros].sort());
  });
});
