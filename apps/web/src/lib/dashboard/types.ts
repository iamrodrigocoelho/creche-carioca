/**
 * Tipos do painel do gestor (RF-10, PRD 8.10).
 *
 * O painel ainda nao le o banco: `Unit` e `Preference` nao existem no schema
 * canonico (entram na Fase 6), entao demanda por unidade e fila de espera nao
 * teriam origem. Ate la o painel roda sobre um conjunto sintetico declarado —
 * ver `demo-data.ts`. Os tipos abaixo ja tem o formato que a consulta real vai
 * devolver, para que a troca da fonte nao mexa na interface.
 */

import type { AgeGroupCode } from '@match/domain';

/** Coordenadoria Regional de Educacao: a unidade territorial do gestor. */
export interface Cre {
  readonly id: string;
  readonly label: string;
}

/** Turno de OFERTA. Diferente de `Shift` do dominio, que admite `AMBOS`:
 *  `AMBOS` e uma preferencia da familia, nunca uma vaga existente. */
export type OfferShift = 'INTEGRAL' | 'PARCIAL';

export type UnitKind = 'EDI' | 'CRECHE_MUNICIPAL' | 'CONVENIADA';

export interface DashboardUnit {
  readonly code: string;
  readonly name: string;
  readonly kind: UnitKind;
  readonly neighborhood: string;
  readonly creId: string;
}

/**
 * Uma linha de demanda por unidade x grupamento x turno.
 *
 * `firstChoice` e `otherChoices` sao disjuntos: uma inscricao conta uma unica
 * vez em `firstChoice` e ate quatro vezes em `otherChoices` (PRD 8.6 limita a
 * cinco preferencias ordenadas). Somar os dois de todas as unidades NAO da o
 * total de inscricoes — por isso o total vive em `DemoProcessSnapshot`.
 */
export interface DemandRow {
  readonly unitCode: string;
  readonly ageGroup: AgeGroupCode;
  readonly shift: OfferShift;
  readonly firstChoice: number;
  readonly otherChoices: number;
  readonly seats: number;
}

/** Situacao das inscricoes do processo corrente (funil de PRD 8.10). */
export interface ApplicationStatusCounts {
  readonly rascunho: number;
  readonly submetida: number;
  readonly cancelada: number;
}

/** Um processo seletivo no historico, para comparacao ano a ano. */
export interface ProcessHistoryPoint {
  readonly processCode: string;
  readonly year: number;
  /** Inscricoes submetidas ate o mesmo dia da janela, para comparacao justa. */
  readonly applicationsAtSameDay: number;
  /** Total ao fim da janela. Ausente no processo em andamento. */
  readonly applicationsFinal?: number;
  readonly seats: number;
}

export interface DemoProcessSnapshot {
  readonly processCode: string;
  readonly processLabel: string;
  /** Dia corrente da janela de inscricao e sua duracao total. */
  readonly windowDay: number;
  readonly windowDays: number;
  /** Instante do snapshot, fixo: o painel e reproduzivel, nao usa relogio. */
  readonly generatedAt: string;
  readonly status: ApplicationStatusCounts;
  readonly cres: readonly Cre[];
  readonly units: readonly DashboardUnit[];
  readonly demand: readonly DemandRow[];
  readonly history: readonly ProcessHistoryPoint[];
}
