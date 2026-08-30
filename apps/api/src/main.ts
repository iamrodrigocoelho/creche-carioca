import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadEnv } from './common/config/env';
import { JsonLogger } from './common/logging/json-logger';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = new JsonLogger('match-api', env.API_LOG_LEVEL);

  const app = await NestFactory.create(AppModule, { logger, bufferLogs: false });
  configureApp(app, env);

  await app.listen(env.API_PORT);

  logger.log('api_started', {
    port: env.API_PORT,
    environment: env.NODE_ENV,
    corsOrigins: env.API_CORS_ORIGINS,
  });
}

void bootstrap();
