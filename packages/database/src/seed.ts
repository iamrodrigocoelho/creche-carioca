import { resolve } from 'node:path';

import { DEMO_AGE_GROUP_POLICY_2026 } from '@match/domain';

import { createPrismaClient, databaseUrlFromEnv } from './client';
import { DataStatus, RuleKind } from '@prisma/client';

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

export async function seed(prisma: ReturnType<typeof createPrismaClient>): Promise<{
  processCode: string;
  ruleVersionCreated: boolean;
}> {
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
  if (existing) {
    return { processCode: process_.code, ruleVersionCreated: false };
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

  return { processCode: process_.code, ruleVersionCreated: true };
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
