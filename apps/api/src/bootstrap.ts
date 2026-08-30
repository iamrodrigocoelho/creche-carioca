import helmet from 'helmet';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JsonLogger } from './common/logging/json-logger';
import type { AppEnv } from './common/config/env';

/**
 * Hardening aplicado a instancia HTTP (PRD 13.5).
 *
 * Extraido de `main.ts` para que os testes de integracao exercitem exatamente a
 * mesma configuracao servida em execucao - inclusive CORS, limite de payload e
 * formato de erro.
 */
export function configureApp(app: INestApplication, env: AppEnv): void {
  const express = app as NestExpressApplication;

  // Cabecalhos de seguranca: CSP, HSTS, X-Content-Type-Options, referrer policy.
  express.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
        },
      },
      // HSTS so faz sentido sob TLS; fora de producao ele e desligado
      // explicitamente para nao fixar `https` no navegador do desenvolvedor.
      ...(env.NODE_ENV === 'production' ? {} : { hsts: false as const }),
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  // A API responde apenas JSON; nenhuma pagina e servida por ela.
  express.getHttpAdapter().getInstance().disable('x-powered-by');

  // PRD 13.5: limitar tamanho de payload.
  express.useBodyParser('json', { limit: env.API_BODY_LIMIT });

  // PRD 13.5: allowlist explicita, nunca curinga.
  app.enableCors({
    origin: env.API_CORS_ORIGINS,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-Correlation-Id'],
    exposedHeaders: ['X-Correlation-Id'],
    credentials: true,
    maxAge: 600,
  });

  app.useGlobalFilters(new AllExceptionsFilter(app.get(JsonLogger)));
  app.enableShutdownHooks();
}
