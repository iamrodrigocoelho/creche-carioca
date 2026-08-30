import { createPrismaClient, seed, type PrismaClient } from '@match/database';

/**
 * Utilitarios de banco para os testes de integracao.
 *
 * O reset usa `TRUNCATE ... CASCADE`, que ignora os triggers append-only de
 * `AuditEvent` e `StatusEvent` - eles bloqueiam UPDATE e DELETE, nao TRUNCATE.
 * Isso e deliberado: a garantia protege a operacao, e a suite ainda precisa de
 * um ponto de partida limpo a cada caso.
 */

const MUTABLE_TABLES = [
  'LocationAnchor',
  'StatusEvent',
  'AuditEvent',
  'Application',
  'Child',
  'Guardian',
] as const;

export function testPrismaClient(): PrismaClient {
  return createPrismaClient({ connectionString: process.env.DATABASE_URL as string });
}

/** Limpa os dados transacionais, preservando processo e regras semeadas. */
export async function resetTransactionalData(prisma: PrismaClient): Promise<void> {
  const list = MUTABLE_TABLES.map((table) => `"${table}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

/** Recria processo e versao de regra a partir do seed oficial do repositorio. */
export async function ensureSeed(prisma: PrismaClient): Promise<void> {
  await seed(prisma);
}

/** Zera tudo, inclusive regras, para exercitar o seed do ponto zero. */
export async function resetEverything(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "LocationAnchor", "StatusEvent", "AuditEvent", "Application", "Child", "Guardian", "RuleVersion", "Process" RESTART IDENTITY CASCADE`,
  );
}
