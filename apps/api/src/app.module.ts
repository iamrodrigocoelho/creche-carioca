import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { ApplicationsModule } from './applications/applications.module';
import { CommonModule } from './common/common.module';
import { loadEnv } from './common/config/env';
import { CorrelationIdMiddleware } from './common/logging/correlation';
import { ContactsModule } from './contacts/contacts.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { LocationAnchorsModule } from './location-anchors/location-anchors.module';

const env = loadEnv();

@Module({
  imports: [
    CommonModule,
    DatabaseModule,
    // PRD 13.5: rate limiting por IP e endpoint.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: env.API_RATE_LIMIT_TTL_MS, limit: env.API_RATE_LIMIT }],
    }),
    HealthModule,
    ApplicationsModule,
    LocationAnchorsModule,
    ContactsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*path');
  }
}
