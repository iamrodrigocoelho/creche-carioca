export { createPrismaClient, databaseUrlFromEnv } from './client';
export type { DatabaseOptions } from './client';

/** Exportado para que os testes de integracao semeiem exatamente como o CLI. */
export { seed } from './seed';

export { PrismaClient, Prisma } from '@prisma/client';

export type {
  Application,
  AuditEvent,
  Child,
  ContactPoint,
  Criterion,
  CriterionResponse,
  Guardian,
  LocationAnchor,
  Process,
  RuleVersion,
  ScoreResult,
  StatusEvent,
} from '@prisma/client';

export {
  AnchorKind,
  ApplicationStatus,
  AuditOrigin,
  ContactChannel,
  ContactRelation,
  ContactStatus,
  DataStatus,
  GeocodingStatus,
  RuleKind,
  Sex,
  Shift,
  SocialPlatform,
} from '@prisma/client';
