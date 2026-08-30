import { describe, expect, it } from 'vitest';

import {
  allSectors,
  percentile90,
  MIN_PRECISION_KM,
  NEIGHBORHOODS,
  resolveCepSector,
  SINGLE_UNIT_PRECISION_KM,
} from './sectors';

/**
 * Os casos saem da propria referencia versionada. Fixar um CEP no codigo
 * quebraria a suite toda vez que a referencia fosse regerada, sem que nada
 * estivesse errado.
 */
const sectors = Object.entries(allSectors());
const multiUnit = sectors.find(([, sector]) => sector.unidades > 1);
const singleUnit = sectors.find(([, sector]) => sector.unidades === 1);

function requireSector(entry: typeof multiUnit) {
  if (entry === undefined) throw new Error('referência sem setor adequado ao teste');
  return entry;
}

describe('resolveCepSector', () => {
  it('resolve um CEP cujo setor esta na referencia', () => {
    const [code, sector] = requireSector(multiUnit);

    expect(resolveCepSector(`${code}000`)).toMatchObject({
      lat: sector.lat,
      lon: sector.lon,
      bairro: sector.bairro,
    });
  });

  it('devolve null sem inventar coordenada quando o setor e desconhecido', () => {
    // 99999 nao e um setor de CEP do municipio do Rio.
    expect(resolveCepSector('99999000')).toBeNull();
  });

  it('e deterministico: o mesmo setor devolve sempre o mesmo ponto', () => {
    const [code] = requireSector(multiUnit);
    expect(resolveCepSector(`${code}123`)).toEqual(resolveCepSector(`${code}999`));
  });

  it('so os cinco primeiros digitos importam', () => {
    const [code] = requireSector(multiUnit);
    expect(resolveCepSector(`${code}001`)).toEqual(resolveCepSector(`${code}002`));
  });
});

describe('incerteza declarada', () => {
  it('nunca afirma precisao melhor que o piso', () => {
    for (const [code] of sectors) {
      const match = resolveCepSector(`${code}000`);
      expect(match?.precisionKm).toBeGreaterThanOrEqual(MIN_PRECISION_KM);
    }
  });

  /**
   * Um setor com uma unica unidade tem raio medido igual a zero — um ponto nao
   * tem dispersao. Reportar isso como precisao perfeita seria o pior tipo de
   * erro: uma estimativa ruim se passando por exata.
   */
  it('nao trata setor de uma unidade so como preciso', () => {
    const [code, sector] = requireSector(singleUnit);

    expect(sector.raioKm).toBe(0);
    expect(resolveCepSector(`${code}000`)?.precisionKm).toBe(SINGLE_UNIT_PRECISION_KM);
    expect(SINGLE_UNIT_PRECISION_KM).toBeGreaterThan(MIN_PRECISION_KM);
  });

  it('usa o raio medido quando ha mais de uma unidade', () => {
    const [code, sector] = requireSector(multiUnit);
    const esperado = Math.max(sector.raioKm, MIN_PRECISION_KM);
    expect(resolveCepSector(`${code}000`)?.precisionKm).toBe(esperado);
  });
});

describe('bairros', () => {
  it('lista os bairros usados no fallback de PRD 8.2, em ordem', () => {
    expect(NEIGHBORHOODS.length).toBeGreaterThan(100);
    expect([...NEIGHBORHOODS]).toEqual([...NEIGHBORHOODS].sort());
  });
});

describe('percentile90', () => {
  it('escolhe o valor na posicao 90%', () => {
    expect(percentile90([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(10);
    expect(percentile90([5, 1, 3])).toBe(5);
  });

  it('nao depende da ordem de entrada', () => {
    expect(percentile90([9, 1, 5, 3, 7])).toBe(percentile90([1, 3, 5, 7, 9]));
  });

  /**
   * Bordas inalcancaveis com a referencia real, mas possiveis se uma importacao
   * degenerada gerar poucos setores. Sem elas a incerteza sairia `undefined`.
   */
  it('cai no piso quando nao ha do que tirar percentil', () => {
    expect(percentile90([])).toBe(MIN_PRECISION_KM);
  });

  it('funciona com um unico valor', () => {
    expect(percentile90([2.5])).toBe(2.5);
  });
});
