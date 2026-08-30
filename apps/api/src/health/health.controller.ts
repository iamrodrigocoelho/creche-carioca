import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { Liveness, Readiness } from '@match/schemas';

import { PrismaService } from '../database/prisma.service';

/**
 * PRD 16.4.
 *
 * `/health/live`: o processo esta vivo.
 * `/health/ready`: dependencias criticas disponiveis. A partir da Fase 2 o
 * PostgreSQL e critico - sem banco a API nao consegue atender nenhuma escrita,
 * entao `ready` passa a responder 503. O Redis segue como opcional e simulado
 * ate a Fase 11, e PRD 16.4 determina que dependencia opcional simulada nao
 * indisponibilize a aplicacao.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): Liveness {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response): Promise<Readiness> {
    const databaseUp = await this.prisma.isReachable();

    const checks: Readiness['checks'] = [
      { name: 'process', status: 'up', critical: true },
      {
        name: 'postgres',
        status: databaseUp ? 'up' : 'down',
        critical: true,
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
