import { randomUUID } from 'node:crypto';

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { findAgeGroupPolicy, resolveAgeGroup } from '@match/domain';
import type { AgeGroupResolution } from '@match/domain';
import type {
  AgeGroupResult,
  ApplicationResponse,
  CreateApplicationInput,
  UpdateApplicationInput,
} from '@match/schemas';

import { CLOCK, type Clock } from '../common/clock';
import {
  APPLICATION_REPOSITORY,
  type ApplicationRecord,
  type ApplicationRepository,
} from './application.repository';

/**
 * Casos de uso da inscricao (RF-01, fatia da Fase 1).
 *
 * O servico nao decide regra de negocio: ele orquestra o repositorio e delega o
 * calculo ao dominio puro. PRD 1.2 proibe LLM ou modelo probabilistico nessa
 * decisao - o caminho aqui e inteiramente deterministico.
 */
@Injectable()
export class ApplicationsService {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly repository: ApplicationRepository,
    @Inject(CLOCK)
    private readonly now: Clock,
  ) {}

  async create(input: CreateApplicationInput): Promise<ApplicationResponse> {
    // Falha cedo se o processo nao tiver regra publicada, antes de gravar qualquer coisa.
    this.requirePolicy(input.processId);

    const timestamp = this.now().toISOString();
    const record: ApplicationRecord = {
      // UUID v4: referencia publica nao sequencial e nao enumeravel (PRD 13.5).
      id: randomUUID(),
      anonymousChildId: randomUUID(),
      status: 'RASCUNHO',
      processId: input.processId,
      birthYear: input.child.birthYear,
      birthMonth: input.child.birthMonth,
      ...(input.child.sex ? { sex: input.child.sex } : {}),
      desiredShift: input.desiredShift,
      ...(input.referenceDate ? { referenceDate: input.referenceDate } : {}),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return this.toResponse(await this.repository.create(record));
  }

  async findById(id: string): Promise<ApplicationResponse> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Inscrição não encontrada.',
      });
    }
    return this.toResponse(record);
  }

  /**
   * PRD 8.1: alterar nascimento OU data de referencia deve recalcular o grupamento.
   * Como o grupamento e derivado na leitura, basta atualizar as entradas.
   */
  async update(id: string, input: UpdateApplicationInput): Promise<ApplicationResponse> {
    const current = await this.repository.findById(id);
    if (!current) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Inscrição não encontrada.',
      });
    }

    const sex = input.child?.sex ?? current.sex;
    const referenceDate = input.referenceDate ?? current.referenceDate;

    const updated: ApplicationRecord = {
      ...current,
      birthYear: input.child?.birthYear ?? current.birthYear,
      birthMonth: input.child?.birthMonth ?? current.birthMonth,
      ...(sex ? { sex } : {}),
      desiredShift: input.desiredShift ?? current.desiredShift,
      ...(referenceDate ? { referenceDate } : {}),
      updatedAt: this.now().toISOString(),
    };

    return this.toResponse(await this.repository.update(updated));
  }

  private requirePolicy(processId: string) {
    const policy = findAgeGroupPolicy(processId);
    if (!policy) {
      throw new BadRequestException({
        code: 'UNKNOWN_PROCESS',
        message: 'Processo seletivo não disponível nesta demonstração.',
      });
    }
    return policy;
  }

  private toResponse(record: ApplicationRecord): ApplicationResponse {
    const policy = this.requirePolicy(record.processId);

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

export function toAgeGroupResult(resolution: AgeGroupResolution): AgeGroupResult {
  return {
    outcome: resolution.outcome,
    code: resolution.band?.code ?? null,
    label: resolution.band?.label ?? null,
    ageInMonths: resolution.ageInMonths,
    referenceDate: resolution.referenceDate,
    policy: resolution.policy,
    explanation: resolution.explanation.map((step) => ({
      code: step.code,
      values: step.values,
      summary: step.summary,
    })),
  };
}
