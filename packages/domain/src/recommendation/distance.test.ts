import { describe, expect, it } from 'vitest';

import { estimateDistance, haversineKm } from './distance';

/** Pontos conhecidos do Rio, para conferir a ordem de grandeza. */
const CENTRO = { latitude: -22.9068, longitude: -43.1729 };
const COPACABANA = { latitude: -22.9711, longitude: -43.1822 };
const CAMPO_GRANDE = { latitude: -22.9035, longitude: -43.5591 };

describe('haversineKm', () => {
  it('é zero para o mesmo ponto', () => {
    expect(haversineKm(CENTRO, CENTRO)).toBe(0);
  });

  it('calcula distâncias plausíveis dentro do município', () => {
    // Centro a Copacabana são cerca de 7 km em linha reta.
    expect(haversineKm(CENTRO, COPACABANA)).toBeGreaterThan(6);
    expect(haversineKm(CENTRO, COPACABANA)).toBeLessThan(8);

    // Centro a Campo Grande, cerca de 40 km.
    expect(haversineKm(CENTRO, CAMPO_GRANDE)).toBeGreaterThan(37);
    expect(haversineKm(CENTRO, CAMPO_GRANDE)).toBeLessThan(43);
  });

  it('é simétrica', () => {
    expect(haversineKm(CENTRO, COPACABANA)).toBeCloseTo(haversineKm(COPACABANA, CENTRO), 9);
  });

  it('não estoura com pontos antípodas', () => {
    const km = haversineKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 180 });
    expect(Number.isFinite(km)).toBe(true);
    expect(km).toBeGreaterThan(20_000);
  });
});

describe('estimateDistance', () => {
  it('arredonda para uma casa e declara o método', () => {
    const estimativa = estimateDistance(CENTRO, COPACABANA);
    expect(estimativa.method).toBe('GEODESICA');
    expect(estimativa.km).toBe(Math.round(estimativa.km * 10) / 10);
  });

  /** PRD 8.5: a distância não pode ser mais precisa que o ponto de partida. */
  it('carrega a incerteza do ponto de referência', () => {
    expect(estimateDistance({ ...CENTRO, precisionKm: 2.5 }, COPACABANA).precisionKm).toBe(2.5);
    expect(estimateDistance(CENTRO, COPACABANA).precisionKm).toBeNull();
  });
});
