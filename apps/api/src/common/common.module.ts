import { Global, Module } from '@nestjs/common';

import { CLOCK, systemClock } from './clock';
import { loadEnv, ENV } from './config/env';
import { IdempotencyStore } from './idempotency/idempotency.store';
import { JsonLogger } from './logging/json-logger';

/**
 * Infraestrutura transversal. Fornecida por factory porque `IdempotencyStore` e
 * `JsonLogger` recebem parametros primitivos, que o container do Nest nao resolve
 * por tipo.
 */
@Global()
@Module({
  providers: [
    { provide: ENV, useFactory: () => loadEnv() },
    { provide: CLOCK, useValue: systemClock },
    { provide: IdempotencyStore, useFactory: () => new IdempotencyStore() },
    {
      provide: JsonLogger,
      useFactory: () => new JsonLogger('match-api', loadEnv().API_LOG_LEVEL),
    },
  ],
  exports: [ENV, CLOCK, IdempotencyStore, JsonLogger],
})
export class CommonModule {}
