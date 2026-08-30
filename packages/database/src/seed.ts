import { resolve } from 'node:path';

import { DEMO_AGE_GROUP_POLICY_2026 } from '@match/domain';

import { createPrismaClient, databaseUrlFromEnv } from './client';
import criteriaReference from './criteria.json';
import unitsReference from './units.json';
import { DataStatus, RuleKind } from '@prisma/client';
import type { DemandLevel } from '@prisma/client';

/**
 * Seed de dados sintéticos (PRD 19, Fase 1 do roadmap: "Criar dados sintéticos").
 *
 * PRD 1.2 proíbe dado pessoal real no ambiente de desenvolvimento. O seed cria
 * apenas o processo de demonstração e a versão de regra de grupamento etário —
 * nenhuma criança, responsável ou inscrição.
 *
 * É idempotente: reexecutar não duplica linhas nem altera o histórico. PRD 8.7
 * determina que alterar uma regra crie uma nova versão em vez de reescrever a
 * anterior, então o seed jamais sobrescreve um `payload` já publicado.
 */

const DEMO_PROCESS = {
  code: DEMO_AGE_GROUP_POLICY_2026.processId,
  name: 'Processo de demonstração 2026',
  referenceDate: DEMO_AGE_GROUP_POLICY_2026.referenceDate,
  status: DataStatus.DEMONSTRACAO,
} as const;

interface UnitReference {
  readonly code: string;
  readonly name: string;
  readonly type: string | null;
  readonly neighborhood: string | null;
  readonly cep: string | null;
  readonly cre: number | null;
  readonly microarea: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly historicalAgeGroups: readonly string[];
  readonly historicalShifts: readonly string[];
  readonly historicalApplications: number;
  readonly historicalChildren: number;
  readonly historicalYears: number;
  readonly demandLevel: string;
}

/**
 * Carrega as unidades do artefato versionado (ADR-0034).
 *
 * Diferente do processo e da regra, isto NAO e dado sintetico: sao unidades
 * publicas reais, derivadas dos datasets da SME. O que e de demonstracao e a
 * oferta de 2026, que ninguem declarou — por isso grupamentos e turnos vao
 * rotulados como historicos.
 *
 * Idempotente por `code`, que e a chave natural vinda da origem (ADR-0018).
 */
export async function seedUnits(
  prisma: ReturnType<typeof createPrismaClient>,
): Promise<{ units: number }> {
  const units = unitsReference.units as readonly UnitReference[];

  // O artefato so muda quando e regerado, e sao 872 upserts sequenciais. Reler
  // o que ja esta la a cada `beforeAll` da suite custava segundos por arquivo de
  // teste, sem mudar nada.
  const current = await prisma.unit.count();
  if (current === units.length) return { units: current };

  for (const unit of units) {
    const data = {
      name: unit.name,
      type: unit.type,
      neighborhood: unit.neighborhood,
      cep: unit.cep,
      cre: unit.cre,
      microarea: unit.microarea,
      latitude: unit.latitude,
      longitude: unit.longitude,
      historicalAgeGroups: [...unit.historicalAgeGroups],
      historicalShifts: [...unit.historicalShifts],
      historicalApplications: unit.historicalApplications,
      historicalChildren: unit.historicalChildren,
      historicalYears: unit.historicalYears,
      demandLevel: unit.demandLevel as DemandLevel,
    };
    await prisma.unit.upsert({
      where: { code: unit.code },
      update: data,
      create: { code: unit.code, ...data },
    });
  }

  return { units: units.length };
}

interface CriterionReference {
  readonly code: number;
  readonly processQuestionId: number;
  readonly text: string;
  readonly order: number;
  readonly points: number;
  readonly isTiebreak: boolean;
}

interface ProcessCriteriaReference {
  readonly year: number;
  readonly prmId: number;
  readonly totalPoints: number;
  readonly criteria: readonly CriterionReference[];
}

/**
 * Ano cuja regua vira a versao de pontuacao da demonstracao.
 *
 * A regua de 2026 nao existe: nenhum edital foi publicado (B-07). 2025 e o
 * processo mais recente com regua completa — 13 perguntas, 100 pontos — e por
 * isso e a escolha mais defensavel. A escolha em si e de demonstracao; a regua
 * copiada e oficial (ADR-0037).
 */
export const SCORING_SOURCE_YEAR = 2025;

/**
 * Politica de confirmacao adotada na demonstracao (ADR-0038).
 *
 * `DECLARADA`: pontua a resposta da familia sem exigir validacao. E o que
 * permite a familia ver a pontuacao enquanto preenche — com `CONFIRMADA`, toda
 * inscricao nova valeria zero ate alguem da rede conferir, e nao ha esse alguem
 * nesta demonstracao.
 */
export const CONFIRMATION_POLICY = 'DECLARADA';

/**
 * Publica a regua de pontuacao como `RuleVersion` do tipo `SCORING`.
 *
 * Idempotente e imutavel, como a regra de grupamento: uma versao ja publicada
 * nunca e reescrita (PRD 8.7). Alterar pesos significa publicar a versao
 * seguinte, o que e decisao explicita e nao efeito do seed.
 */
export async function seedScoringRule(
  prisma: ReturnType<typeof createPrismaClient>,
  processId: string,
): Promise<{ criteria: number; created: boolean }> {
  const source = (criteriaReference.processes as readonly ProcessCriteriaReference[]).find(
    (item) => item.year === SCORING_SOURCE_YEAR,
  );
  if (source === undefined) {
    throw new Error(`Regua de ${SCORING_SOURCE_YEAR} ausente em criteria.json.`);
  }

  const existing = await prisma.ruleVersion.findUnique({
    where: { processId_kind_version: { processId, kind: RuleKind.SCORING, version: 1 } },
    include: { criteria: { select: { id: true } } },
  });
  if (existing) {
    return { criteria: existing.criteria.length, created: false };
  }

  await prisma.ruleVersion.create({
    data: {
      processId,
      kind: RuleKind.SCORING,
      version: 1,
      status: DataStatus.DEMONSTRACAO,
      source: `Régua oficial do processo ${source.prmId} (${source.year}), reaproveitada na demonstração. A regra de 2026 não foi publicada (PRD 21).`,
      effectiveFrom: new Date(`${DEMO_PROCESS.referenceDate}T00:00:00.000Z`),
      payload: {
        sourceYear: source.year,
        sourcePrmId: source.prmId,
        totalPoints: source.totalPoints,
        confirmationPolicy: CONFIRMATION_POLICY,
      },
      criteria: {
        create: source.criteria.map((criterion) => ({
          code: criterion.code,
          processQuestionId: criterion.processQuestionId,
          text: criterion.text,
          order: criterion.order,
          points: criterion.points,
          isTiebreak: criterion.isTiebreak,
        })),
      },
    },
  });

  return { criteria: source.criteria.length, created: true };
}

export async function seed(prisma: ReturnType<typeof createPrismaClient>): Promise<{
  processCode: string;
  ruleVersionCreated: boolean;
  units: number;
  criteria: number;
}> {
  const { units } = await seedUnits(prisma);
  const process_ = await prisma.process.upsert({
    where: { code: DEMO_PROCESS.code },
    // Nome e data de referência podem ser corrigidos; o código é a identidade.
    update: {
      name: DEMO_PROCESS.name,
      referenceDate: DEMO_PROCESS.referenceDate,
      status: DEMO_PROCESS.status,
    },
    create: DEMO_PROCESS,
  });

  const existing = await prisma.ruleVersion.findUnique({
    where: {
      processId_kind_version: {
        processId: process_.id,
        kind: RuleKind.AGE_GROUP,
        version: DEMO_AGE_GROUP_POLICY_2026.version,
      },
    },
  });

  // Regra já publicada é imutável (PRD 8.7). Publicar uma alteração significa
  // criar uma versão nova, o que é uma decisão explícita, não efeito do seed.
  const scoring = await seedScoringRule(prisma, process_.id);

  if (existing) {
    return {
      processCode: process_.code,
      ruleVersionCreated: false,
      units,
      criteria: scoring.criteria,
    };
  }

  await prisma.ruleVersion.create({
    data: {
      processId: process_.id,
      kind: RuleKind.AGE_GROUP,
      version: DEMO_AGE_GROUP_POLICY_2026.version,
      status: DataStatus.DEMONSTRACAO,
      source: DEMO_AGE_GROUP_POLICY_2026.source,
      effectiveFrom: new Date(`${DEMO_AGE_GROUP_POLICY_2026.referenceDate}T00:00:00.000Z`),
      // Reconstruído como literais simples: `InputJsonValue` do Prisma exige
      // objetos indexáveis, que a interface readonly do domínio não satisfaz.
      payload: {
        bands: DEMO_AGE_GROUP_POLICY_2026.bands.map((band) => ({
          code: band.code,
          label: band.label,
          minAgeMonths: band.minAgeMonths,
          maxAgeMonths: band.maxAgeMonths,
        })),
      },
    },
  });

  return {
    processCode: process_.code,
    ruleVersionCreated: true,
    units,
    criteria: scoring.criteria,
  };
}

async function main(): Promise<void> {
  // `dist/src/seed.js` -> raiz do repositório. O arquivo é opcional: em CI as
  // variáveis já vêm do ambiente.
  for (const envFile of ['../../../.env', '../../.env']) {
    try {
      process.loadEnvFile(resolve(__dirname, envFile));
    } catch {
      // Ambiente já configurado externamente. Segue adiante.
    }
  }

  const prisma = createPrismaClient({ connectionString: databaseUrlFromEnv() });

  try {
    const result = await seed(prisma);
    console.log(
      JSON.stringify({
        message: 'seed_concluido',
        processCode: result.processCode,
        ruleVersionCreated: result.ruleVersionCreated,
        units: result.units,
        criteria: result.criteria,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Executa apenas quando chamado diretamente, permitindo que os testes importem
// `seed()` sem disparar efeito colateral.
if (require.main === module) {
  void main();
}
