import { Global, Module } from '@nestjs/common';

import { AuditService } from './audit.service';
import { PrismaService } from './prisma.service';
import { RuleVersionService } from './rule-version.service';

/**
 * Acesso transacional ao PostgreSQL. Global porque auditoria e regras versionadas
 * sao transversais a praticamente todo caso de uso a partir da Fase 2.
 */
@Global()
@Module({
  providers: [PrismaService, AuditService, RuleVersionService],
  exports: [PrismaService, AuditService, RuleVersionService],
})
export class DatabaseModule {}
