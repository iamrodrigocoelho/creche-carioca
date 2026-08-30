import { describe, expect, it } from 'vitest';

import {
  isFarFromAllAnchors,
  recommendUnits,
  type RecommendableUnit,
  type RecommendationAnchor,
} from './recommend';

const CENTRO = { latitude: -22.9068, longitude: -43.1729 };

function unit(id: string, extras: Partial<RecommendableUnit> = {}): RecommendableUnit {
  return {
    id,
    code: `0${id}`,
    name: `Unidade ${id}`,
    type: 'Creche',
    neighborhood: 'CENTRO',
    cre: 1,
    latitude: CENTRO.latitude,
    longitude: CENTRO.longitude,
    historicalAgeGroups: ['Maternal I'],
    historicalShifts: ['Integral'],
    historicalApplications: 120,
    demandLevel: 'MEDIA',
    ...extras,
  };
}

function residence(extras: Partial<RecommendationAnchor> = {}): RecommendationAnchor {
  return {
    position: 1,
    kind: 'RESIDENCIA',
    ...CENTRO,
    precisionKm: 0.8,
    neighborhood: 'CENTRO',
    ...extras,
  };
}

describe('recommendUnits', () => {
  it('ordena da mais próxima para a mais distante', () => {
    const perto = unit('a');
    const longe = unit('b', { latitude: -22.9711, longitude: -43.1822 });

    const resultado = recommendUnits({ units: [longe, perto], anchors: [residence()] });
    expect(resultado.map((r) => r.unit.id)).toEqual(['a', 'b']);
  });

  /**
   * PRD 8.5: a recomendação territorial não pode impedir a escolha livre. A
   * ordem muda; o conjunto, nunca.
   */
  it('não descarta nenhuma unidade por distância', () => {
    const perto = unit('a');
    const longe = unit('b', { latitude: -22.9035, longitude: -43.5591 });

    const resultado = recommendUnits({ units: [perto, longe], anchors: [residence()] });
    expect(resultado).toHaveLength(2);
  });

  /** 20 das 872 unidades não têm coordenada; sumir com elas seria um defeito. */
  it('mantém unidades sem coordenada, no fim da lista', () => {
    const semLocal = unit('sem', { latitude: null, longitude: null });
    const resultado = recommendUnits({ units: [semLocal, unit('a')], anchors: [residence()] });

    expect(resultado.map((r) => r.unit.id)).toEqual(['a', 'sem']);
    expect(resultado[1]?.nearestKm).toBeNull();
    expect(resultado[1]?.reasons.map((r) => r.code)).toContain('SEM_LOCALIZACAO');
  });

  it('usa o ponto mais próximo entre todos os informados', () => {
    const trabalho: RecommendationAnchor = {
      position: 2,
      kind: 'TRABALHO',
      latitude: -22.9711,
      longitude: -43.1822,
      precisionKm: 1,
      neighborhood: 'COPACABANA',
    };
    const perto = unit('a', { latitude: -22.9711, longitude: -43.1822 });

    const [resultado] = recommendUnits({ units: [perto], anchors: [residence(), trabalho] });
    expect(resultado?.distances).toHaveLength(2);
    expect(resultado?.nearestKm).toBe(0);
    expect(resultado?.reasons.map((r) => r.code)).toContain('PROXIMA_DE_OUTRO_PONTO');
  });

  it('explica proximidade da residência', () => {
    const [resultado] = recommendUnits({ units: [unit('a')], anchors: [residence()] });
    expect(resultado?.reasons.map((r) => r.code)).toContain('PROXIMA_DA_RESIDENCIA');
  });

  it('reconhece o mesmo bairro apesar de acento e caixa', () => {
    const [resultado] = recommendUnits({
      units: [unit('a', { neighborhood: 'São Cristóvão' })],
      anchors: [residence({ neighborhood: 'SAO CRISTOVAO' })],
    });
    expect(resultado?.reasons.map((r) => r.code)).toContain('MESMO_BAIRRO');
  });

  it('marca grupamento e turno atendidos historicamente', () => {
    const [resultado] = recommendUnits({
      units: [unit('a')],
      anchors: [residence()],
      ageGroupCode: 'MATERNAL_I',
      shift: 'Integral',
    });
    const codigos = resultado?.reasons.map((r) => r.code) ?? [];
    expect(codigos).toContain('ATENDE_O_GRUPAMENTO');
    expect(codigos).toContain('ATENDE_O_TURNO');
  });

  /**
   * A origem registra um único "Berçário"; a política o divide em I e II. Uma
   * unidade que atendeu Berçário atendeu as duas faixas (ADR-0035).
   */
  it('casa as duas faixas de berçário com o rótulo único da origem', () => {
    const bercario = unit('a', { historicalAgeGroups: ['Berçário'] });
    for (const code of ['BERCARIO_I', 'BERCARIO_II']) {
      const [resultado] = recommendUnits({ units: [bercario], anchors: [], ageGroupCode: code });
      expect(resultado?.reasons.map((r) => r.code)).toContain('ATENDE_O_GRUPAMENTO');
    }
  });

  it('não marca grupamento que a unidade nunca atendeu', () => {
    const so_maternal = unit('a', { historicalAgeGroups: ['Maternal II'] });
    const [resultado] = recommendUnits({
      units: [so_maternal],
      anchors: [],
      ageGroupCode: 'BERCARIO_I',
    });
    expect(resultado?.reasons.map((r) => r.code)).not.toContain('ATENDE_O_GRUPAMENTO');
  });

  it('sempre informa o nível de demanda histórica', () => {
    const [resultado] = recommendUnits({ units: [unit('a')], anchors: [] });
    expect(resultado?.reasons.map((r) => r.code)).toContain('DEMANDA_HISTORICA');
  });

  it('sem pontos de referência, ordena por nome e não calcula distância', () => {
    const resultado = recommendUnits({
      units: [unit('b', { name: 'Zebra' }), unit('a', { name: 'Abelha' })],
      anchors: [],
    });
    expect(resultado.map((r) => r.unit.name)).toEqual(['Abelha', 'Zebra']);
    expect(resultado[0]?.distances).toEqual([]);
  });

  it('é estável: mesma entrada, mesma ordem', () => {
    const entrada = { units: [unit('a'), unit('b'), unit('c')], anchors: [residence()] };
    expect(recommendUnits(entrada).map((r) => r.unit.id)).toEqual(
      recommendUnits(entrada).map((r) => r.unit.id),
    );
  });

  it('herda a incerteza do ponto na distância (PRD 8.5)', () => {
    const [resultado] = recommendUnits({
      units: [unit('a')],
      anchors: [residence({ precisionKm: 3.1 })],
    });
    expect(resultado?.distances[0]?.distance.precisionKm).toBe(3.1);
    expect(resultado?.distances[0]?.distance.method).toBe('GEODESICA');
  });
});

describe('isFarFromAllAnchors', () => {
  /** PRD 8.6: alertas informam, não bloqueiam. */
  it('sinaliza acima de cinco quilômetros', () => {
    const [longe] = recommendUnits({
      units: [unit('a', { latitude: -22.9035, longitude: -43.5591 })],
      anchors: [residence()],
    });
    expect(longe && isFarFromAllAnchors(longe)).toBe(true);

    const [perto] = recommendUnits({ units: [unit('b')], anchors: [residence()] });
    expect(perto && isFarFromAllAnchors(perto)).toBe(false);
  });

  it('não sinaliza unidade sem coordenada', () => {
    const [sem] = recommendUnits({
      units: [unit('a', { latitude: null, longitude: null })],
      anchors: [residence()],
    });
    expect(sem && isFarFromAllAnchors(sem)).toBe(false);
  });
});
