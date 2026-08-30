import { describe, expect, it } from 'vitest';

import { AGE_GROUP_CODES } from '@match/domain';

import { getDemoSnapshot } from './demo-data';
import {
  SMALL_CELL_THRESHOLD,
  aggregateByAgeGroup,
  aggregateByRegion,
  compareWithHistory,
  filterDemand,
  formatDelta,
  formatRatio,
  pressureLevel,
  rankUnitsByDemand,
  suppressSmallCell,
  totalize,
} from './metrics';
import type { DemandRow, ProcessHistoryPoint } from './types';

const row = (over: Partial<DemandRow> = {}): DemandRow => ({
  unitCode: '9000000',
  ageGroup: 'BERCARIO_I',
  shift: 'INTEGRAL',
  firstChoice: 30,
  otherChoices: 45,
  seats: 10,
  ...over,
});

describe('totalize', () => {
  it('mede a razao candidato/vaga pela primeira opcao, nao pela demanda total', () => {
    // A mesma inscricao pode citar cinco unidades; usar `anyChoice` inflaria a
    // razao e faria toda unidade parecer critica.
    const totals = totalize([row({ firstChoice: 30, otherChoices: 45, seats: 10 })]);

    expect(totals.anyChoice).toBe(75);
    expect(totals.ratio).toBe(3);
  });

  it('trata a fila como excedente sobre as vagas, nunca negativa', () => {
    expect(totalize([row({ firstChoice: 4, seats: 10 })]).waiting).toBe(0);
    expect(totalize([row({ firstChoice: 30, seats: 10 })]).waiting).toBe(20);
  });

  it('nao divide por zero quando a unidade nao oferta o turno', () => {
    expect(totalize([row({ seats: 0, firstChoice: 12 })]).ratio).toBe(0);
  });

  it('devolve zeros para um recorte vazio', () => {
    expect(totalize([])).toEqual({
      firstChoice: 0,
      anyChoice: 0,
      seats: 0,
      ratio: 0,
      waiting: 0,
    });
  });
});

describe('pressureLevel', () => {
  it('classifica pelos limiares declarados, sem depender de cor', () => {
    expect(pressureLevel(0.9)).toBe('equilibrada');
    expect(pressureLevel(1)).toBe('moderada');
    expect(pressureLevel(2)).toBe('alta');
    expect(pressureLevel(3.4)).toBe('critica');
  });
});

describe('suppressSmallCell', () => {
  it('suprime celula abaixo do limiar de k-anonimato', () => {
    expect(suppressSmallCell(SMALL_CELL_THRESHOLD - 1)).toBeNull();
    expect(suppressSmallCell(SMALL_CELL_THRESHOLD)).toBe(SMALL_CELL_THRESHOLD);
  });

  it('mantem o zero visivel: ausencia de fila nao identifica ninguem', () => {
    expect(suppressSmallCell(0)).toBe(0);
  });
});

describe('filterDemand', () => {
  const { units, demand } = getDemoSnapshot();

  it('combina territorio, grupamento e turno', () => {
    const filtered = filterDemand(demand, units, {
      creId: 'CRE-09',
      ageGroup: 'BERCARIO_I',
      shift: 'INTEGRAL',
    });
    const codes = new Set(units.filter((u) => u.creId === 'CRE-09').map((u) => u.code));

    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((r) => codes.has(r.unitCode))).toBe(true);
    expect(filtered.every((r) => r.ageGroup === 'BERCARIO_I' && r.shift === 'INTEGRAL')).toBe(true);
  });

  it('sem filtro, devolve o conjunto inteiro', () => {
    expect(filterDemand(demand, units, {})).toHaveLength(demand.length);
  });
});

describe('rankUnitsByDemand', () => {
  const { units, demand, cres } = getDemoSnapshot();

  it('ordena da unidade mais procurada para a menos procurada', () => {
    const ranked = rankUnitsByDemand(demand, units, cres);
    const firstChoices = ranked.map((entry) => entry.firstChoice);

    expect(ranked).toHaveLength(units.length);
    expect([...firstChoices].sort((a, b) => b - a)).toEqual(firstChoices);
  });

  it('resolve o rotulo da CRE de cada unidade', () => {
    const ranked = rankUnitsByDemand(demand, units, cres);
    expect(ranked.every((entry) => entry.creLabel.endsWith('CRE'))).toBe(true);
  });

  it('omite unidades sem nenhuma linha no recorte', () => {
    const oneUnit = demand.filter((r) => r.unitCode === units[0]?.code);
    expect(rankUnitsByDemand(oneUnit, units, cres)).toHaveLength(1);
  });
});

describe('aggregateByRegion', () => {
  const { units, demand, cres } = getDemoSnapshot();

  it('ordena pela fila absoluta e conta as unidades do territorio', () => {
    const regions = aggregateByRegion(demand, units, cres);
    const waiting = regions.map((entry) => entry.waiting);

    expect(regions).toHaveLength(cres.length);
    expect([...waiting].sort((a, b) => b - a)).toEqual(waiting);
    expect(regions.every((entry) => entry.unitCount > 0)).toBe(true);
  });

  it('preserva o total: a soma dos territorios e o total da rede', () => {
    const regions = aggregateByRegion(demand, units, cres);
    const sum = regions.reduce((total, entry) => total + entry.firstChoice, 0);

    expect(sum).toBe(totalize(demand).firstChoice);
  });

  it('ignora linha cuja unidade nao esta no catalogo', () => {
    const withOrphan = [...demand, row({ unitCode: 'INEXISTENTE' })];
    const regions = aggregateByRegion(withOrphan, units, cres);

    expect(regions.reduce((t, e) => t + e.firstChoice, 0)).toBe(totalize(demand).firstChoice);
  });
});

describe('aggregateByAgeGroup', () => {
  it('mantem a ordem do catalogo de grupamentos', () => {
    const { demand } = getDemoSnapshot();
    const groups = aggregateByAgeGroup(demand, AGE_GROUP_CODES);

    expect(groups.map((entry) => entry.ageGroup)).toEqual([...AGE_GROUP_CODES]);
  });

  it('Bercario I e o grupamento de maior pressao no conjunto de demonstracao', () => {
    const { demand } = getDemoSnapshot();
    const groups = aggregateByAgeGroup(demand, AGE_GROUP_CODES);
    const highest = [...groups].sort((a, b) => b.ratio - a.ratio)[0];

    expect(highest?.ageGroup).toBe('BERCARIO_I');
  });
});

describe('compareWithHistory', () => {
  const point = (over: Partial<ProcessHistoryPoint>): ProcessHistoryPoint => ({
    processCode: 'DEMO',
    year: 2025,
    applicationsAtSameDay: 100,
    seats: 50,
    ...over,
  });

  it('compara o mesmo dia da janela, nunca o parcial contra o total fechado', () => {
    const result = compareWithHistory([
      point({ year: 2025, applicationsAtSameDay: 100, applicationsFinal: 400, seats: 50 }),
      point({ year: 2026, applicationsAtSameDay: 120, seats: 50 }),
    ]);

    expect(result.applicationsDeltaPct).toBe(20);
    expect(result.seatsDeltaPct).toBe(0);
  });

  it('ordena a serie por ano e toma o mais recente como corrente', () => {
    const result = compareWithHistory([
      point({ year: 2026, applicationsAtSameDay: 120 }),
      point({ year: 2024, applicationsAtSameDay: 80 }),
      point({ year: 2025, applicationsAtSameDay: 100 }),
    ]);

    expect(result.series.map((entry) => entry.year)).toEqual([2024, 2025, 2026]);
    expect(result.current.year).toBe(2026);
    expect(result.previous?.year).toBe(2025);
  });

  it('nao inventa variacao quando nao ha processo anterior', () => {
    const result = compareWithHistory([point({ year: 2026 })]);

    expect(result.previous).toBeUndefined();
    expect(result.applicationsDeltaPct).toBeUndefined();
    expect(formatDelta(result.applicationsDeltaPct)).toBe('sem base de comparação');
  });

  it('recusa uma serie vazia em vez de renderizar um painel sem processo', () => {
    expect(() => compareWithHistory([])).toThrow(/Historico vazio/);
  });
});

describe('formatacao', () => {
  it('usa virgula decimal e uma casa', () => {
    expect(formatRatio(3.456)).toBe('3,5');
    expect(formatDelta(12.34)).toBe('+12,3%');
    expect(formatDelta(-4)).toBe('-4,0%');
  });
});

describe('conjunto de demonstracao', () => {
  it('e estavel entre chamadas: a apresentacao nao muda a cada recarga', () => {
    const a = getDemoSnapshot();
    const b = getDemoSnapshot();

    expect(a.demand).toEqual(b.demand);
    expect(a.status).toEqual(b.status);
  });

  it('mantem a coerencia interna que o painel assume', () => {
    const snapshot = getDemoSnapshot();
    const totals = totalize(snapshot.demand);

    // O total submetido e a soma das primeiras opcoes: uma inscricao, uma
    // primeira opcao.
    expect(snapshot.status.submetida).toBe(totals.firstChoice);
    // Demanda em qualquer opcao nunca e menor que a primeira opcao.
    expect(snapshot.demand.every((r) => r.otherChoices >= 0)).toBe(true);
    // Toda unidade oferta os dois turnos em todos os grupamentos.
    expect(snapshot.demand).toHaveLength(snapshot.units.length * AGE_GROUP_CODES.length * 2);
    expect(snapshot.demand.every((r) => r.seats > 0)).toBe(true);
    // O processo corrente fecha a serie historica.
    expect(snapshot.history[snapshot.history.length - 1]?.processCode).toBe(snapshot.processCode);
  });

  it('produz uma rede sob pressao, que e o cenario que o painel precisa mostrar', () => {
    const snapshot = getDemoSnapshot();
    const totals = totalize(snapshot.demand);

    expect(totals.ratio).toBeGreaterThan(1);
    expect(totals.waiting).toBeGreaterThan(0);
  });
});
