import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@prisma/client';

/**
 * Fábrica do cliente Prisma.
 *
 * O Prisma 7 exige um driver adapter; aqui é o `pg` sobre PostgreSQL.
 * A URL vem sempre do ambiente — nenhuma credencial é escrita no repositório
 * (PRD 13.4).
 *
 * PRD 15.4 alerta contra N+1 e includes excessivos; PRD 15.6 exige timeout em
 * toda chamada externa. Os limites de pool e os timeouts abaixo são o ponto
 * único onde essas políticas são aplicadas.
 */

export interface DatabaseOptions {
  readonly connectionString: string;
  /** Tamanho máximo do pool. Workers escalam horizontalmente (PRD 15.1). */
  readonly maxConnections?: number;
  /** PRD 15.6: nenhuma chamada externa sem timeout. */
  readonly connectionTimeoutMs?: number;
  readonly statementTimeoutMs?: number;
  readonly log?: boolean;
}

const DEFAULT_MAX_CONNECTIONS = 10;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000;

export function createPrismaClient(options: DatabaseOptions): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: options.connectionString,
    max: options.maxConnections ?? DEFAULT_MAX_CONNECTIONS,
    connectionTimeoutMillis: options.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS,
    statement_timeout: options.statementTimeoutMs ?? DEFAULT_STATEMENT_TIMEOUT_MS,
  });

  return new PrismaClient({
    adapter,
    // Consultas nunca são logadas com parâmetros: eles podem conter dado pessoal
    // (PRD 13.4). Apenas avisos e erros do driver chegam ao log.
    log: options.log ? ['warn', 'error'] : ['error'],
  });
}

/** Lê a URL do ambiente e falha rápido quando ausente. */
export function databaseUrlFromEnv(source: NodeJS.ProcessEnv = process.env): string {
  const url = source.DATABASE_URL;

  if (!url || url.trim() === '') {
    throw new Error('DATABASE_URL não definida. Veja .env.example.');
  }

  return url;
}
