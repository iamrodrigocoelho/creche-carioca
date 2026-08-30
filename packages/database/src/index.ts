export { createPrismaClient, databaseUrlFromEnv } from './client';
export type { DatabaseOptions } from './client';

/** Exportado para que os testes de integracao semeiem exatamente como o CLI. */
export { seed } from './seed';

export { PrismaClient, Prisma } from '@prisma/client';

export type {
  Application,
  AuditEvent,
  Child,
  Guardian,
  Process,
  RuleVersion,
  StatusEvent,
} from '@prisma/client';

export { ApplicationStatus, AuditOrigin, DataStatus, RuleKind, Sex, Shift } from '@prisma/client';
