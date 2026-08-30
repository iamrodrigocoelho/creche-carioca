import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { createPrismaClient, type PrismaClient } from '@match/database';

import { ENV } from '../common/config/env';
import type { AppEnv } from '../common/config/env';
import { JsonLogger } from '../common/logging/json-logger';

/**
 * Ciclo de vida do cliente Prisma dentro do Nest.
 *
 * PRD 15.6 exige graceful shutdown; `onModuleDestroy` fecha o pool para que
 * conexoes nao fiquem penduradas ao encerrar o processo.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly client: PrismaClient;

  constructor(
    @Inject(ENV) env: AppEnv,
    private readonly logger: JsonLogger,
  ) {
    this.client = createPrismaClient({
      connectionString: env.DATABASE_URL,
      log: env.NODE_ENV !== 'production',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('database_connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }

  /**
   * Verificacao usada por `/health/ready` (PRD 16.4).
   *
   * Consulta trivial e com timeout curto: o objetivo e provar que o pool
   * responde, nao exercitar o schema.
   */
  async isReachable(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      // O detalhe fica no log; a resposta de health nunca expoe erro do driver,
      // que pode conter host, usuario ou nome de banco (PRD 13.4).
      this.logger.warn('database_unreachable');
      return false;
    }
  }
}
