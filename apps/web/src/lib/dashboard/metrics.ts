/**
 * Derivacoes do painel do gestor.
 *
 * Tudo aqui e funcao pura sobre `DemandRow[]`: nenhuma consulta, nenhum relogio,
 * nenhuma aleatoriedade. Quando a fonte deixar de ser sintetica, estas funcoes
 * continuam valendo — e continuam testaveis sem banco.
 */

import type { AgeGroupCode } from '@match/domain';

import type { Cre, DashboardUnit, DemandRow, OfferShift, ProcessHistoryPoint } from './types';

/**
 * Limiar de supressao de celula pequena (k-anonimato).
 *
 * PRD 13.2 exige minimizacao. "1 inscricao, Bercario I, unidade X" reidentifica
 * uma crianca para quem conhece o bairro; a celula e suprimida em vez de exibida.
 */
export const SMALL_CELL_THRESHOLD = 5;

/** Devolve `null` quando a celula e pequena demais para ser publicada. */
export function suppressSmallCell(value: number): number | null {
  return value > 0 && value < SMALL_CELL_THRESHOLD ? null : value;
}

export interface DemandFilter {
  readonly creId?: string;
  readonly ageGroup?: AgeGroupCode;
  readonly shift?: OfferShift;
}

export function filterDemand(
  rows: readonly DemandRow[],
  units: readonly DashboardUnit[],
  filter: DemandFilter,
): readonly DemandRow[] {
  const creByUnit = new Map(units.map((unit) => [unit.code, unit.creId]));

  return rows.filter((row) => {
    if (filter.ageGroup && row.ageGroup !== filter.ageGroup) return false;
    if (filter.shift && row.shift !== filter.shift) return false;
    if (filter.creId && creByUnit.get(row.unitCode) !== filter.creId) return false;
    return true;
  });
}

/** Agregado comum a unidade, territorio e grupamento. */
export interface DemandTotals {
  /** Inscricoes que colocaram o recorte como primeira opcao. */
  readonly firstChoice: number;
  /** Inscricoes que citaram o recorte em qualquer das cinco preferencias. */
  readonly anyChoice: number;
  readonly seats: number;
  /**
   * Candidatos por vaga, medido pela primeira opcao. Usar a demanda total aqui
   * inflaria o indicador: a mesma inscricao aparece em ate cinco unidades.
   */
  readonly ratio: number;
  /** Fila de espera: quantos ficam sem vaga se so a primeira opcao fosse honrada. */
  readonly waiting: number;
}

export function totalize(rows: readonly DemandRow[]): DemandTotals {
  let firstChoice = 0;
  let otherChoices = 0;
  let seats = 0;

  for (const row of rows) {
    firstChoice += row.firstChoice;
    otherChoices += row.otherChoices;
    seats += row.seats;
  }

  return {
    firstChoice,
    anyChoice: firstChoice + otherChoices,
    seats,
    ratio: seats === 0 ? 0 : firstChoice / seats,
    waiting: Math.max(0, firstChoice - seats),
  };
}

/**
 * Classificacao da pressao.
 *
 * DESIGN.md nao formaliza cores de severidade e o PRD 17 exige que a informacao
 * nunca dependa so de cor. A pressao e dita em palavras e reforcada pelo
 * comprimento da barra; nenhum semaforo vermelho/verde e inventado aqui.
 */
export type PressureLevel = 'critica' | 'alta' | 'moderada' | 'equilibrada';

export function pressureLevel(ratio: number): PressureLevel {
  if (ratio >= 3) return 'critica';
  if (ratio >= 2) return 'alta';
  if (ratio >= 1) return 'moderada';
  return 'equilibrada';
}

export const PRESSURE_LABELS: Readonly<Record<PressureLevel, string>> = {
  critica: 'Crítica',
  alta: 'Alta',
  moderada: 'Moderada',
  equilibrada: 'Equilibrada',
};

export interface UnitDemand extends DemandTotals {
  readonly unit: DashboardUnit;
  readonly creLabel: string;
  readonly level: PressureLevel;
}

/** Demanda por unidade, ordenada por primeira opcao (as "mais procuradas"). */
export function rankUnitsByDemand(
  rows: readonly DemandRow[],
  units: readonly DashboardUnit[],
  cres: readonly Cre[],
): readonly UnitDemand[] {
  const creLabels = new Map(cres.map((cre) => [cre.id, cre.label]));
  const byUnit = new Map<string, DemandRow[]>();

  for (const row of rows) {
    const bucket = byUnit.get(row.unitCode);
    if (bucket) bucket.push(row);
    else byUnit.set(row.unitCode, [row]);
  }

  return units
    .filter((unit) => byUnit.has(unit.code))
    .map((unit) => {
      const totals = totalize(byUnit.get(unit.code) ?? []);
      return {
        ...totals,
        unit,
        creLabel: creLabels.get(unit.creId) ?? unit.creId,
        level: pressureLevel(totals.ratio),
      };
    })
    .sort(
      (a, b) => b.firstChoice - a.firstChoice || a.unit.name.localeCompare(b.unit.name, 'pt-BR'),
    );
}

export interface RegionDemand extends DemandTotals {
  readonly cre: Cre;
  readonly unitCount: number;
  readonly level: PressureLevel;
}

/** Fila e pressao por CRE, ordenadas pela fila absoluta. */
export function aggregateByRegion(
  rows: readonly DemandRow[],
  units: readonly DashboardUnit[],
  cres: readonly Cre[],
): readonly RegionDemand[] {
  const creByUnit = new Map(units.map((unit) => [unit.code, unit.creId]));
  const byCre = new Map<string, DemandRow[]>();
  const unitsByCre = new Map<string, Set<string>>();

  for (const row of rows) {
    const creId = creByUnit.get(row.unitCode);
    if (!creId) continue;

    const bucket = byCre.get(creId);
    if (bucket) bucket.push(row);
    else byCre.set(creId, [row]);

    const seen = unitsByCre.get(creId);
    if (seen) seen.add(row.unitCode);
    else unitsByCre.set(creId, new Set([row.unitCode]));
  }

  return cres
    .filter((cre) => byCre.has(cre.id))
    .map((cre) => {
      const totals = totalize(byCre.get(cre.id) ?? []);
      return {
        ...totals,
        cre,
        unitCount: unitsByCre.get(cre.id)?.size ?? 0,
        level: pressureLevel(totals.ratio),
      };
    })
    .sort((a, b) => b.waiting - a.waiting || b.ratio - a.ratio);
}

export interface AgeGroupDemand extends DemandTotals {
  readonly ageGroup: AgeGroupCode;
  readonly level: PressureLevel;
}

/** Fila por grupamento: Bercario I e Pre-Escola sao problemas distintos. */
export function aggregateByAgeGroup(
  rows: readonly DemandRow[],
  ageGroups: readonly AgeGroupCode[],
): readonly AgeGroupDemand[] {
  return ageGroups
    .map((ageGroup) => {
      const totals = totalize(rows.filter((row) => row.ageGroup === ageGroup));
      return { ...totals, ageGroup, level: pressureLevel(totals.ratio) };
    })
    .filter((entry) => entry.seats > 0 || entry.firstChoice > 0);
}

export interface HistoryComparison {
  readonly current: ProcessHistoryPoint;
  readonly previous?: ProcessHistoryPoint;
  /** Variacao das inscricoes no mesmo dia da janela, em pontos percentuais. */
  readonly applicationsDeltaPct?: number;
  readonly seatsDeltaPct?: number;
  /** Candidatos por vaga em cada processo, sempre no mesmo dia da janela. */
  readonly series: readonly (ProcessHistoryPoint & { readonly ratio: number })[];
}

/**
 * Compara o processo corrente com o anterior no MESMO dia da janela.
 *
 * Comparar o parcial de hoje com o total fechado do ano passado e o erro de
 * leitura mais comum num painel destes, e ele sempre sugere queda de demanda.
 */
export function compareWithHistory(history: readonly ProcessHistoryPoint[]): HistoryComparison {
  const series = [...history]
    .sort((a, b) => a.year - b.year)
    .map((point) => ({
      ...point,
      ratio: point.seats === 0 ? 0 : point.applicationsAtSameDay / point.seats,
    }));

  const current = series[series.length - 1];
  if (!current) {
    throw new Error('Historico vazio: o processo corrente precisa estar na serie.');
  }
  const previous = series[series.length - 2];

  const delta = (now: number, before: number): number | undefined =>
    before === 0 ? undefined : ((now - before) / before) * 100;

  if (!previous) {
    return { current, series };
  }

  const applicationsDeltaPct = delta(current.applicationsAtSameDay, previous.applicationsAtSameDay);
  const seatsDeltaPct = delta(current.seats, previous.seats);

  return {
    current,
    previous,
    ...(applicationsDeltaPct === undefined ? {} : { applicationsDeltaPct }),
    ...(seatsDeltaPct === undefined ? {} : { seatsDeltaPct }),
    series,
  };
}

const INTEGER_FORMAT = new Intl.NumberFormat('pt-BR');
const RATIO_FORMAT = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatInteger(value: number): string {
  return INTEGER_FORMAT.format(value);
}

/** "3,4 por vaga". Uma casa decimal: mais que isso finge precisao. */
export function formatRatio(value: number): string {
  return RATIO_FORMAT.format(value);
}

export function formatDelta(value: number | undefined): string {
  if (value === undefined) return 'sem base de comparação';
  const sign = value > 0 ? '+' : '';
  return `${sign}${RATIO_FORMAT.format(value)}%`;
}
