import { Module } from '@nestjs/common';

import { APPLICATION_REPOSITORY } from './application.repository';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { InMemoryApplicationRepository } from './in-memory-application.repository';

/**
 * ADR-0003: a troca do adapter em memoria pelo adapter Prisma na Fase 2 acontece
 * exclusivamente nesta linha de `provide`.
 */
@Module({
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    { provide: APPLICATION_REPOSITORY, useClass: InMemoryApplicationRepository },
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
