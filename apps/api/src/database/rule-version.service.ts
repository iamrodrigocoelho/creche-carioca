import { Injectable } from '@nestjs/common';

import { RuleKind } from '@match/database';
import type { AgeGroupPolicy } from '@match/domain';
import { toAgeGroupPolicy } from '@match/schemas';

import { PrismaService } from './prisma.service';

/**
 * Carrega a regra vigente a partir de `RuleVersion` (PRD 8.7, 11).
 *
 * Antes da Fase 2 a politica de grupamento vinha de uma constante no dominio.
 * Agora o banco e a autoridade sobre qual versao estava vigente, o que e o que
 * torna possivel reconstruir uma pontuacao historica: PRD 8.7 exige que alterar
 * uma regra crie uma nova versao em vez de reescrever a anterior.
 *
 * A leitura sempre revalida o `payload` com Zod. Regra malformada falha de forma
 * explicita em vez de produzir um resultado silenciosamente errado.
 */
@Injectable()
export class RuleVersionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Versao vigente da regra de grupamento etario para o processo.
   * Retorna `null` quando o processo nao existe ou nao tem regra publicada.
   */
  async findAgeGroupPolicy(processCode: string): Promise<AgeGroupPolicy | null> {
    const process = await this.prisma.client.process.findUnique({
      where: { code: processCode },
      select: {
        id: true,
        code: true,
        referenceDate: true,
        ruleVersions: {
          where: { kind: RuleKind.AGE_GROUP },
          // Maior versao vigente. `effectiveFrom` desempata regras publicadas
          // para o mesmo processo em datas diferentes.
          orderBy: [{ effectiveFrom: 'desc' }, { version: 'desc' }],
          take: 1,
          select: {
            id: true,
            version: true,
            status: true,
            source: true,
            payload: true,
          },
        },
      },
    });

    const rule = process?.ruleVersions[0];
    if (!process || !rule) return null;

    return toAgeGroupPolicy({
      id: rule.id,
      version: rule.version,
      status: rule.status,
      processCode: process.code,
      referenceDate: process.referenceDate,
      source: rule.source,
      payload: rule.payload,
    });
  }
}
