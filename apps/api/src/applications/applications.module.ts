import { Module } from '@nestjs/common';

import { APPLICATION_REPOSITORY } from './application.repository';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { PrismaApplicationRepository } from './prisma-application.repository';

/**
 * ADR-0013: o adapter em memoria da Fase 1 foi substituido pelo adapter
 * PostgreSQL/Prisma. A troca ficou restrita a esta linha de `provide` - nem o
 * controller nem o dominio precisaram mudar.
 */
@Module({
  controllers: [ApplicationsController],
  providers: [
    ApplicationsService,
    { provide: APPLICATION_REPOSITORY, useClass: PrismaApplicationRepository },
  ],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
