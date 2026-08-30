import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  score,
  type ConfirmationPolicy,
  type CriterionAnswer,
  type ScoreOutcome,
  type ScoringRule,
} from '@match/matching-engine';
import { RuleKind } from '@match/database';
import type { Prisma } from '@match/database';
import type {
  CriterionListResponse,
  PutCriterionResponsesInput,
  ScoreHistoryResponse,
  ScoreResultResponse,
} from '@match/schemas';

import { currentCorrelationId } from '../common/logging/correlation';
import { ANONYMOUS_ACTOR } from '../common/write-context';
import { AuditService } from '../database/audit.service';
import { PrismaService } from '../database/prisma.service';

/**
 * Casos de uso da pontuacao (RF-07, PRD 8.7).
 *
 * O calculo em si vive em `@match/matching-engine`, puro e sem I/O. Aqui se
 * carrega a regua vigente, se lê as respostas e se **persiste o resultado com o
 * detalhamento junto**: PRD 8.7 exige guardar entradas, versao da regra, pontos
 * por criterio, total e desempates.
 *
 * `ScoreResult` e append-only, garantido por trigger. Recalcular grava uma linha
 * nova; nenhuma anterior e tocada.
 */
@Injectable()
export class ScoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listCriteria(applicationId: string): Promise<CriterionListResponse> {
    const { rule, criteria } = await this.requireRule(applicationId);
    const responses = await this.responsesFor(applicationId);

    const items = criteria.map((criterion) => {
      const response = responses.get(criterion.code);
      return {
        code: criterion.code,
        text: criterion.text,
        order: criterion.order,
        points: criterion.points,
        isTiebreak: criterion.isTiebreak,
        answer: response?.answer ?? null,
        confirmed: response?.confirmed ?? false,
      };
    });

    return {
      applicationId,
      criteria: items,
      rule,
      // Só os pontuáveis contam para "completo": os de desempate são opcionais e
      // não respondê-los apenas deixa de favorecer a inscrição.
      isComplete: items.every((item) => item.isTiebreak || item.answer !== null),
    };
  }

  /**
   * Substitui as respostas informadas e recalcula.
   *
   * Só os critérios enviados são tocados: responder uma pergunta não apaga as
   * outras, porque a família responde aos poucos.
   */
  async replaceResponses(
    applicationId: string,
    input: PutCriterionResponsesInput,
  ): Promise<ScoreResultResponse> {
    const { criteria } = await this.requireRule(applicationId);
    const byCode = new Map(criteria.map((criterion) => [criterion.code, criterion]));

    const unknown = input.responses.filter((item) => !byCode.has(item.code));
    if (unknown.length > 0) {
      throw new BadRequestException({
        code: 'UNKNOWN_CRITERION',
        message: 'Um dos critérios respondidos não existe na regra vigente.',
      });
    }

    await this.prisma.client.$transaction(async (tx) => {
      for (const item of input.responses) {
        const criterion = byCode.get(item.code) as { id: string };
        await tx.criterionResponse.upsert({
          where: {
            applicationId_criterionId: { applicationId, criterionId: criterion.id },
          },
          // `confirmed` não é definido pela família: a validação é da rede, e
          // enquanto não existe fluxo de validação (Fase 10) permanece falso.
          create: { applicationId, criterionId: criterion.id, answer: item.answer },
          update: { answer: item.answer },
        });
      }

      await this.audit.record(
        {
          correlationId: currentCorrelationId(),
          ...ANONYMOUS_ACTOR,
          action: 'CRITERION_RESPONSES_REPLACE',
          entity: 'CriterionResponse',
          entityId: applicationId,
          // As respostas são dado sensível (PRD 8.16): `criterionResponses` já
          // está na lista de redação, e só a contagem sobrevive.
          metadata: { applicationId, criterios: input.responses.length },
        },
        tx,
      );
    });

    return this.computeAndStore(applicationId);
  }

  /** Calcula e grava um resultado novo. Nunca sobrescreve (PRD 8.7). */
  async computeAndStore(applicationId: string): Promise<ScoreResultResponse> {
    const { rule, criteria, ruleVersionId } = await this.requireRule(applicationId);
    const responses = await this.responsesFor(applicationId);

    const answers: CriterionAnswer[] = criteria.flatMap((criterion) => {
      const response = responses.get(criterion.code);
      return response === undefined
        ? []
        : [{ code: criterion.code, answer: response.answer, confirmed: response.confirmed }];
    });

    const outcome = score(toScoringRule(rule, criteria), answers);
    const correlationId = currentCorrelationId();

    const stored = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.scoreResult.create({
        data: {
          applicationId,
          ruleVersionId,
          total: outcome.total,
          maxTotal: outcome.maxTotal,
          breakdown: toBreakdown(outcome),
          correlationId,
        },
      });

      await this.audit.record(
        {
          correlationId,
          ...ANONYMOUS_ACTOR,
          action: 'SCORE_COMPUTED',
          entity: 'ScoreResult',
          entityId: created.id,
          metadata: {
            applicationId,
            total: outcome.total,
            maxTotal: outcome.maxTotal,
            ruleVersion: outcome.rule.version,
          },
        },
        tx,
      );

      return created;
    });

    return toResponse(stored.id, applicationId, outcome, stored.computedAt);
  }

  /** Histórico completo: PRD 8.7 proíbe reescrever resultado. */
  async history(applicationId: string): Promise<ScoreHistoryResponse> {
    await this.requireApplication(applicationId);
    const rows = await this.prisma.client.scoreResult.findMany({
      where: { applicationId },
      orderBy: { computedAt: 'desc' },
    });

    return {
      applicationId,
      results: rows.map((row) => ({
        id: row.id,
        applicationId,
        total: row.total,
        maxTotal: row.maxTotal,
        ...(row.breakdown as unknown as {
          lines: ScoreResultResponse['lines'];
          tiebreaks: ScoreResultResponse['tiebreaks'];
          rule: ScoreResultResponse['rule'];
        }),
        computedAt: row.computedAt.toISOString(),
      })),
    };
  }

  private async requireApplication(applicationId: string): Promise<{ processId: string }> {
    const application = await this.prisma.client.application.findUnique({
      where: { id: applicationId },
      select: { processId: true },
    });
    if (!application) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Inscrição não encontrada.',
      });
    }
    return application;
  }

  /** Carrega a versão de pontuação vigente do processo da inscrição. */
  private async requireRule(applicationId: string): Promise<{
    ruleVersionId: string;
    rule: {
      processCode: string;
      version: number;
      status: 'DEMONSTRACAO' | 'OFICIAL';
      sourceYear: number;
      confirmationPolicy: ConfirmationPolicy;
    };
    criteria: readonly {
      id: string;
      code: number;
      text: string;
      order: number;
      points: number;
      isTiebreak: boolean;
    }[];
  }> {
    const { processId } = await this.requireApplication(applicationId);

    const version = await this.prisma.client.ruleVersion.findFirst({
      where: { processId, kind: RuleKind.SCORING },
      orderBy: { version: 'desc' },
      include: {
        criteria: { orderBy: { order: 'asc' } },
        process: { select: { code: true } },
      },
    });

    if (!version) {
      throw new NotFoundException({
        code: 'SCORING_RULE_NOT_FOUND',
        message: 'Este processo ainda não tem regra de pontuação publicada.',
      });
    }

    const payload = version.payload as { sourceYear?: number; confirmationPolicy?: string };

    return {
      ruleVersionId: version.id,
      rule: {
        processCode: version.process.code,
        version: version.version,
        status: version.status,
        sourceYear: payload.sourceYear ?? 0,
        confirmationPolicy: (payload.confirmationPolicy ?? 'DECLARADA') as ConfirmationPolicy,
      },
      criteria: version.criteria,
    };
  }

  private async responsesFor(
    applicationId: string,
  ): Promise<Map<number, { answer: boolean; confirmed: boolean }>> {
    const rows = await this.prisma.client.criterionResponse.findMany({
      where: { applicationId },
      include: { criterion: { select: { code: true } } },
    });
    return new Map(
      rows.map((row) => [row.criterion.code, { answer: row.answer, confirmed: row.confirmed }]),
    );
  }
}

function toScoringRule(
  rule: {
    processCode: string;
    version: number;
    status: 'DEMONSTRACAO' | 'OFICIAL';
    sourceYear: number;
    confirmationPolicy: ConfirmationPolicy;
  },
  criteria: readonly {
    code: number;
    text: string;
    order: number;
    points: number;
    isTiebreak: boolean;
  }[],
): ScoringRule {
  return { ...rule, criteria };
}

/** Snapshot gravado no `breakdown`: reproduz o resultado sem recalcular. */
function toBreakdown(outcome: ScoreOutcome): Prisma.InputJsonValue {
  return {
    lines: outcome.lines.map((line) => ({ ...line })),
    tiebreaks: outcome.tiebreaks.map((tiebreak) => ({ ...tiebreak })),
    rule: { ...outcome.rule },
  } as unknown as Prisma.InputJsonValue;
}

function toResponse(
  id: string,
  applicationId: string,
  outcome: ScoreOutcome,
  computedAt: Date,
): ScoreResultResponse {
  return {
    id,
    applicationId,
    total: outcome.total,
    maxTotal: outcome.maxTotal,
    lines: outcome.lines.map((line) => ({ ...line })),
    tiebreaks: outcome.tiebreaks.map((tiebreak) => ({ ...tiebreak })),
    rule: { ...outcome.rule },
    computedAt: computedAt.toISOString(),
  };
}
