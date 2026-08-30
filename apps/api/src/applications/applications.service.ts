import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { resolveAgeGroup } from '@match/domain';
import type { AgeGroupPolicy } from '@match/domain';
import { toAgeGroupResult } from '@match/schemas';
import type {
  ApplicationResponse,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '@match/schemas';

import { currentCorrelationId } from '../common/logging/correlation';
import { ANONYMOUS_ACTOR, type WriteContext } from '../common/write-context';
import { RuleVersionService } from '../database/rule-version.service';
import {
  APPLICATION_REPOSITORY,
  UnknownProcessError,
  type ApplicationRecord,
  type ApplicationRepository,
} from './application.repository';

/**
 * Casos de uso da inscricao (RF-01).
 *
 * O servico nao decide regra de negocio: ele orquestra repositorio e regra
 * versionada, e delega o calculo ao dominio puro. PRD 1.2 proibe LLM ou modelo
 * probabilistico nessa decisao - o caminho aqui e inteiramente deterministico.
 *
 * A partir da Fase 2 a politica de grupamento vem de `RuleVersion` no banco, e
 * nao mais de uma constante de codigo (ADR-0014).
 */
@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly repository: ApplicationRepository,
    private readonly rules: RuleVersionService,
  ) {}

  async create(input: CreateApplicationInput): Promise<ApplicationResponse> {
    // Falha cedo se o processo nao tiver regra publicada, antes de gravar.
    const policy = await this.requirePolicy(input.processId);

    try {
      const record = await this.repository.create(
        {
          processId: input.processId,
          birthYear: input.child.birthYear,
          birthMonth: input.child.birthMonth,
          ...(input.child.sex ? { sex: input.child.sex } : {}),
          desiredShift: input.desiredShift,
          ...(input.referenceDate ? { referenceDate: input.referenceDate } : {}),
        },
        this.writeContext(),
      );

      return this.toResponse(record, policy);
    } catch (error) {
      if (error instanceof UnknownProcessError) throw unknownProcess();
      throw error;
    }
  }

  async findById(id: string): Promise<ApplicationResponse> {
    const record = await this.repository.findById(id);
    if (!record) throw notFound();

    return this.toResponse(record, await this.requirePolicy(record.processId));
  }

  /**
   * PRD 8.1: alterar nascimento OU data de referencia deve recalcular o grupamento.
   * Como o grupamento e derivado na leitura (ADR-0012), basta atualizar as entradas.
   */
  async update(id: string, input: UpdateApplicationInput): Promise<ApplicationResponse> {
    const record = await this.repository.update(
      id,
      {
        ...(input.child?.birthYear !== undefined ? { birthYear: input.child.birthYear } : {}),
        ...(input.child?.birthMonth !== undefined ? { birthMonth: input.child.birthMonth } : {}),
        ...(input.child?.sex !== undefined ? { sex: input.child.sex } : {}),
        ...(input.desiredShift !== undefined ? { desiredShift: input.desiredShift } : {}),
        ...(input.referenceDate !== undefined ? { referenceDate: input.referenceDate } : {}),
      },
      this.writeContext(),
    );

    if (!record) throw notFound();

    return this.toResponse(record, await this.requirePolicy(record.processId));
  }

  /**
   * Identidade do autor da escrita.
   *
   * A autenticacao simulada e o RBAC entram na Fase 10 (PRD 13.3). Ate la o ator
   * e explicitamente anonimo - o campo existe desde ja para que a trilha de
   * auditoria nunca precise ser retrofitada.
   */
  private writeContext(): WriteContext {
    return { correlationId: currentCorrelationId(), ...ANONYMOUS_ACTOR };
  }

  private async requirePolicy(processCode: string): Promise<AgeGroupPolicy> {
    const policy = await this.rules.findAgeGroupPolicy(processCode);
    if (!policy) throw unknownProcess();
    return policy;
  }

  private toResponse(record: ApplicationRecord, policy: AgeGroupPolicy): ApplicationResponse {
    const resolution = resolveAgeGroup({
      birthYear: record.birthYear,
      birthMonth: record.birthMonth,
      policy,
      ...(record.referenceDate ? { referenceDate: record.referenceDate } : {}),
    });

    return {
      id: record.id,
      anonymousChildId: record.anonymousChildId,
      status: record.status,
      processId: record.processId,
      child: {
        birthYear: record.birthYear,
        birthMonth: record.birthMonth,
        ...(record.sex ? { sex: record.sex } : {}),
      },
      desiredShift: record.desiredShift,
      ageGroup: toAgeGroupResult(resolution),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

function notFound(): NotFoundException {
  return new NotFoundException({
    code: 'APPLICATION_NOT_FOUND',
    message: 'Inscrição não encontrada.',
  });
}

function unknownProcess(): BadRequestException {
  return new BadRequestException({
    code: 'UNKNOWN_PROCESS',
    message: 'Processo seletivo não disponível nesta demonstração.',
  });
}
