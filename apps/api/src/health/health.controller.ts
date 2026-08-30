import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { Liveness, Readiness } from '@match/schemas';

/**
 * PRD 16.4.
 *
 * `/health/live`: o processo esta vivo.
 * `/health/ready`: dependencias criticas disponiveis. Na Fase 1 nao ha banco nem
 * Redis; eles aparecem como `skipped` e nao criticos, porque PRD 16.4 determina
 * que dependencias opcionais simuladas nao indisponibilizem a aplicacao. A Fase 2
 * promove PostgreSQL a critico e a Fase 11 faz o mesmo com o Redis.
 */
@Controller('health')
export class HealthController {
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): Liveness {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get('ready')
  ready(@Res({ passthrough: true }) response: Response): Readiness {
    const checks: Readiness['checks'] = [
      { name: 'process', status: 'up', critical: true },
      {
        name: 'postgres',
        status: 'skipped',
        critical: false,
        detail: 'Persistência entra na Fase 2 (repositório em memória na Fase 1).',
      },
      {
        name: 'redis',
        status: 'skipped',
        critical: false,
        detail: 'Filas entram na Fase 11.',
      },
    ];

    const ready = checks.every((check) => !check.critical || check.status === 'up');
    response.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return { status: ready ? 'ready' : 'not_ready', checks };
  }
}
