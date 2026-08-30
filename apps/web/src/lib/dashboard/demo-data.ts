/**
 * Conjunto sintetico do painel do gestor.
 *
 * PRD 1.2 proibe apresentar dado de demonstracao como retrato oficial da rede.
 * Por isso NADA aqui e real: os nomes de unidade sao ficticios, construidos na
 * convencao de nomenclatura da rede (EDI / CM / CP), e o vinculo com a CRE e
 * ilustrativo. Os bairros sao reais apenas para dar escala geografica ao
 * exemplo. Toda superficie que consome estes dados carrega o selo de
 * demonstracao.
 *
 * O conjunto e DETERMINISTICO: um gerador com semente fixa produz sempre os
 * mesmos numeros, para que a apresentacao seja reproduzivel e para que uma
 * mudanca acidental quebre o teste de estabilidade em vez de passar despercebida.
 *
 * Quando a Fase 6 trouxer `Unit` e `Preference` para o banco, este arquivo sai e
 * `getDemoSnapshot()` vira uma consulta — o formato de retorno nao muda.
 */

import { AGE_GROUP_CODES, type AgeGroupCode } from '@match/domain';

import type {
  Cre,
  DashboardUnit,
  DemandRow,
  DemoProcessSnapshot,
  OfferShift,
  ProcessHistoryPoint,
  UnitKind,
} from './types';

export const OFFER_SHIFTS: readonly OfferShift[] = ['INTEGRAL', 'PARCIAL'];

export const CRES: readonly Cre[] = [
  { id: 'CRE-01', label: '1ª CRE' },
  { id: 'CRE-02', label: '2ª CRE' },
  { id: 'CRE-03', label: '3ª CRE' },
  { id: 'CRE-04', label: '4ª CRE' },
  { id: 'CRE-05', label: '5ª CRE' },
  { id: 'CRE-06', label: '6ª CRE' },
  { id: 'CRE-07', label: '7ª CRE' },
  { id: 'CRE-08', label: '8ª CRE' },
  { id: 'CRE-09', label: '9ª CRE' },
  { id: 'CRE-10', label: '10ª CRE' },
  { id: 'CRE-11', label: '11ª CRE' },
];

/** Nomes ficticios; bairros reais. Ver a nota metodologica no topo. */
const UNIT_SEED: readonly (readonly [string, UnitKind, string, string])[] = [
  ['EDI Praca da Bandeira', 'EDI', 'Praça da Bandeira', 'CRE-01'],
  ['CM Morro do Pinto', 'CRECHE_MUNICIPAL', 'Santo Cristo', 'CRE-01'],
  ['EDI Largo do Caju', 'EDI', 'Caju', 'CRE-01'],
  ['CP Recanto do Catumbi', 'CONVENIADA', 'Catumbi', 'CRE-01'],
  ['CM Ladeira de Sao Cristovao', 'CRECHE_MUNICIPAL', 'São Cristóvão', 'CRE-01'],
  ['EDI Jardim Botafogo', 'EDI', 'Botafogo', 'CRE-02'],
  ['CM Ruas do Humaita', 'CRECHE_MUNICIPAL', 'Humaitá', 'CRE-02'],
  ['EDI Vila Isabel Menina', 'EDI', 'Vila Isabel', 'CRE-02'],
  ['CP Semente do Grajau', 'CONVENIADA', 'Grajaú', 'CRE-02'],
  ['EDI Rio Bonsucesso', 'EDI', 'Bonsucesso', 'CRE-03'],
  ['CM Beira da Mare', 'CRECHE_MUNICIPAL', 'Maré', 'CRE-03'],
  ['EDI Passarela da Penha', 'EDI', 'Penha', 'CRE-03'],
  ['CP Girassol de Ramos', 'CONVENIADA', 'Ramos', 'CRE-03'],
  ['EDI Estacao do Meier', 'EDI', 'Méier', 'CRE-04'],
  ['CM Engenho Novo', 'CRECHE_MUNICIPAL', 'Engenho Novo', 'CRE-04'],
  ['EDI Cachambi Cresce', 'EDI', 'Cachambi', 'CRE-04'],
  ['CP Casa de Piedade', 'CONVENIADA', 'Piedade', 'CRE-04'],
  ['EDI Vila da Penha Sul', 'EDI', 'Vila da Penha', 'CRE-05'],
  ['CM Iraja Cidade', 'CRECHE_MUNICIPAL', 'Irajá', 'CRE-05'],
  ['EDI Vicente de Carvalho', 'EDI', 'Vicente de Carvalho', 'CRE-05'],
  ['CP Colmeia de Coelho Neto', 'CONVENIADA', 'Coelho Neto', 'CRE-05'],
  ['EDI Ilha do Governador', 'EDI', 'Jardim Guanabara', 'CRE-06'],
  ['CM Portal da Ilha', 'CRECHE_MUNICIPAL', 'Cocotá', 'CRE-06'],
  ['EDI Pitangueiras', 'EDI', 'Pitangueiras', 'CRE-06'],
  ['EDI Madureira Menina', 'EDI', 'Madureira', 'CRE-07'],
  ['CM Cascadura Cresce', 'CRECHE_MUNICIPAL', 'Cascadura', 'CRE-07'],
  ['EDI Oswaldo Cruz Norte', 'EDI', 'Oswaldo Cruz', 'CRE-07'],
  ['CP Quintal de Marechal', 'CONVENIADA', 'Marechal Hermes', 'CRE-07'],
  ['EDI Bangu Central', 'EDI', 'Bangu', 'CRE-08'],
  ['CM Realengo Novo', 'CRECHE_MUNICIPAL', 'Realengo', 'CRE-08'],
  ['EDI Padre Miguel', 'EDI', 'Padre Miguel', 'CRE-08'],
  ['CP Vila Kennedy Cresce', 'CONVENIADA', 'Vila Kennedy', 'CRE-08'],
  ['EDI Campo Grande Norte', 'EDI', 'Campo Grande', 'CRE-09'],
  ['CM Estrada do Mendanha', 'CRECHE_MUNICIPAL', 'Campo Grande', 'CRE-09'],
  ['EDI Inhoaiba Menina', 'EDI', 'Inhoaíba', 'CRE-09'],
  ['CP Semente de Cosmos', 'CONVENIADA', 'Cosmos', 'CRE-09'],
  ['EDI Santa Cruz Leste', 'EDI', 'Santa Cruz', 'CRE-10'],
  ['CM Sepetiba Mar', 'CRECHE_MUNICIPAL', 'Sepetiba', 'CRE-10'],
  ['EDI Paciencia Cresce', 'EDI', 'Paciência', 'CRE-10'],
  ['CP Guaratiba Menina', 'CONVENIADA', 'Guaratiba', 'CRE-10'],
  ['EDI Taquara Central', 'EDI', 'Taquara', 'CRE-11'],
  ['CM Freguesia Jacarepagua', 'CRECHE_MUNICIPAL', 'Freguesia', 'CRE-11'],
  ['EDI Cidade de Deus', 'EDI', 'Cidade de Deus', 'CRE-11'],
  ['CP Curicica Cresce', 'CONVENIADA', 'Curicica', 'CRE-11'],
];

export const DEMO_UNITS: readonly DashboardUnit[] = UNIT_SEED.map(
  ([name, kind, neighborhood, creId], index) => ({
    // Codigo sintetico de 7 digitos, na largura do `esc_codigo` real (PRD 10.3).
    code: String(9000000 + index),
    name,
    kind,
    neighborhood,
    creId,
  }),
);

/**
 * Gerador com semente (mulberry32). Determinismo e requisito do produto:
 * PRD 8.8 exige que a mesma entrada produza sempre a mesma saida, e uma
 * apresentacao que muda de numero a cada recarga nao pode ser discutida.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vagas tipicas por turno, por porte de unidade. */
const SEATS_BY_KIND: Readonly<Record<UnitKind, number>> = {
  EDI: 26,
  CRECHE_MUNICIPAL: 20,
  CONVENIADA: 14,
};

/**
 * Pressao relativa por grupamento. Bercario I e o gargalo real da rede: menos
 * turmas, razao adulto/crianca mais exigente e a maior demanda das familias que
 * voltam do periodo de licenca.
 */
const PRESSURE_BY_AGE_GROUP: Readonly<Record<AgeGroupCode, number>> = {
  BERCARIO_I: 3.1,
  BERCARIO_II: 2.2,
  MATERNAL_I: 1.5,
  MATERNAL_II: 1.1,
};

/** Multiplicador territorial: a Zona Oeste concentra a maior fila da rede. */
const PRESSURE_BY_CRE: Readonly<Record<string, number>> = {
  'CRE-01': 1.0,
  'CRE-02': 0.7,
  'CRE-03': 1.4,
  'CRE-04': 0.9,
  'CRE-05': 1.3,
  'CRE-06': 0.8,
  'CRE-07': 1.2,
  'CRE-08': 1.5,
  'CRE-09': 1.7,
  'CRE-10': 1.6,
  'CRE-11': 1.2,
};

/** Integral concentra a procura; parcial tem oferta menor e fila menor. */
const SHIFT_WEIGHT: Readonly<Record<OfferShift, { seats: number; demand: number }>> = {
  INTEGRAL: { seats: 0.65, demand: 0.78 },
  PARCIAL: { seats: 0.35, demand: 0.22 },
};

function buildDemand(): readonly DemandRow[] {
  const random = seededRandom(20260331);
  const rows: DemandRow[] = [];

  for (const unit of DEMO_UNITS) {
    // Popularidade sorteada UMA vez por unidade, independente do porte. Sem ela
    // o ranking vira uma lista das unidades maiores: a procura passaria a ser
    // consequencia da oferta, e o painel nunca mostraria a creche pequena e
    // disputada — que e justamente o caso que exige decisao.
    const popularity = 0.55 + random() * 1.6;

    for (const ageGroup of AGE_GROUP_CODES) {
      for (const shift of OFFER_SHIFTS) {
        const weight = SHIFT_WEIGHT[shift];
        const seats = Math.max(
          6,
          Math.round(SEATS_BY_KIND[unit.kind] * weight.seats * (0.85 + random() * 0.3)),
        );
        const pressure =
          PRESSURE_BY_AGE_GROUP[ageGroup] *
          (PRESSURE_BY_CRE[unit.creId] ?? 1) *
          (0.7 + random() * 0.8);
        const firstChoice = Math.round(seats * pressure * weight.demand * popularity);
        // Uma inscricao cita ate cinco unidades: a demanda "em qualquer opcao"
        // e sempre um multiplo da primeira opcao, nunca menor.
        const otherChoices = Math.round(firstChoice * (1.1 + random() * 0.9));

        rows.push({ unitCode: unit.code, ageGroup, shift, firstChoice, otherChoices, seats });
      }
    }
  }

  return rows;
}

const DEMO_DEMAND = buildDemand();

/**
 * Total de inscricoes do processo corrente.
 *
 * Cada inscricao tem exatamente uma primeira opcao, entao o total submetido e a
 * soma de `firstChoice`. Rascunhos e cancelamentos nao escolheram unidade e por
 * isso nao aparecem em nenhuma linha de demanda — a mesma assimetria que o banco
 * real vai ter.
 */
const SUBMITTED = DEMO_DEMAND.reduce((total, row) => total + row.firstChoice, 0);

/**
 * Serie historica dos processos anteriores.
 *
 * Derivada do proprio snapshot corrente, e nao de numeros soltos: o conjunto de
 * demonstracao cobre 44 unidades, nao a rede inteira, entao uma serie na escala
 * do municipio produziria uma queda de dois tercos que e artefato do recorte,
 * nao demanda. As taxas abaixo sao declaradas — demanda crescendo mais rapido
 * que a oferta, que e o padrao que o painel existe para tornar visivel.
 */
const HISTORY_RATES: readonly {
  readonly year: number;
  /** Fracao das inscricoes do processo corrente, no mesmo dia da janela. */
  readonly applications: number;
  readonly seats: number;
}[] = [
  { year: 2022, applications: 0.74, seats: 0.9 },
  { year: 2023, applications: 0.81, seats: 0.93 },
  { year: 2024, applications: 0.88, seats: 0.95 },
  { year: 2025, applications: 0.94, seats: 0.98 },
];

/** Razao entre o total ao fim da janela e o parcial do dia 12 de 30. */
const WINDOW_CLOSING_FACTOR = 2.15;

function buildHistory(currentSeats: number): readonly ProcessHistoryPoint[] {
  return HISTORY_RATES.map(({ year, applications, seats }) => {
    const atSameDay = Math.round(SUBMITTED * applications);
    return {
      processCode: `DEMO-${year}`,
      year,
      applicationsAtSameDay: atSameDay,
      applicationsFinal: Math.round(atSameDay * WINDOW_CLOSING_FACTOR),
      seats: Math.round(currentSeats * seats),
    };
  });
}

/**
 * Snapshot do painel. Sincrono e sem relogio: `generatedAt` e fixo para que a
 * pagina renderize identica no servidor e no cliente.
 */
export function getDemoSnapshot(): DemoProcessSnapshot {
  const currentSeats = DEMO_DEMAND.reduce((total, row) => total + row.seats, 0);

  return {
    processCode: 'DEMO-2026',
    processLabel: 'Processo de demonstração 2026',
    windowDay: 12,
    windowDays: 30,
    generatedAt: '2026-03-31T09:00:00-03:00',
    status: {
      submetida: SUBMITTED,
      // Proporcoes de funil declaradas, nao medidas: a Fase 2 ja grava
      // `StatusEvent`, entao no banco real estes tres numeros sao um GROUP BY.
      rascunho: Math.round(SUBMITTED * 0.19),
      cancelada: Math.round(SUBMITTED * 0.04),
    },
    cres: CRES,
    units: DEMO_UNITS,
    demand: DEMO_DEMAND,
    history: [
      ...buildHistory(currentSeats),
      {
        processCode: 'DEMO-2026',
        year: 2026,
        applicationsAtSameDay: SUBMITTED,
        seats: currentSeats,
      },
    ],
  };
}
