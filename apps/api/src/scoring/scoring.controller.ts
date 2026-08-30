import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';

import {
  putCriterionResponsesSchema,
  type CriterionListResponse,
  type PutCriterionResponsesInput,
  type ScoreHistoryResponse,
  type ScoreResultResponse,
} from '@match/schemas';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ScoringService } from './scoring.service';

/**
 * Pontuacao versionada (RF-07, PRD 12.4).
 *
 * `POST /score-runs` calcula e **grava um resultado novo**; `GET` devolve o
 * historico completo, do mais recente ao mais antigo. Nada e sobrescrito: PRD
 * 8.7 determina que uma alteracao de regra nunca reescreva resultado historico.
 */
@Controller()
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  /** Catálogo vigente com as respostas já dadas. */
  @Get('applications/:id/criteria')
  async listCriteria(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
  ): Promise<CriterionListResponse> {
    return this.scoring.listCriteria(applicationId);
  }

  /** Registra respostas e devolve a pontuação recalculada. */
  @Put('applications/:id/criteria')
  async replaceResponses(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Body(new ZodValidationPipe(putCriterionResponsesSchema)) input: PutCriterionResponsesInput,
  ): Promise<ScoreResultResponse> {
    return this.scoring.replaceResponses(applicationId, input);
  }

  @Post('applications/:id/score-runs')
  @HttpCode(HttpStatus.CREATED)
  async compute(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
  ): Promise<ScoreResultResponse> {
    return this.scoring.computeAndStore(applicationId);
  }

  @Get('applications/:id/score-runs')
  async history(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
  ): Promise<ScoreHistoryResponse> {
    return this.scoring.history(applicationId);
  }
}
