import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Query } from '@nestjs/common';

import {
  putPreferencesSchema,
  recommendationQuerySchema,
  type PreferenceListResponse,
  type PutPreferencesInput,
  type RecommendationListResponse,
  type RecommendationQuery,
} from '@match/schemas';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { UnitsService } from './units.service';

/**
 * Recomendacao de unidades e preferencias (RF-05, RF-06, PRD 12.4).
 */
@Controller()
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get('units/recommendations')
  async recommend(
    @Query(new ZodValidationPipe(recommendationQuerySchema)) query: RecommendationQuery,
  ): Promise<RecommendationListResponse> {
    return this.units.recommend(query);
  }

  @Get('applications/:id/preferences')
  async listPreferences(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
  ): Promise<PreferenceListResponse> {
    return this.units.listPreferences(applicationId);
  }

  /** Substitui a lista inteira: a ordem enviada é o dado (PRD 8.6). */
  @Put('applications/:id/preferences')
  async replacePreferences(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Body(new ZodValidationPipe(putPreferencesSchema)) input: PutPreferencesInput,
  ): Promise<PreferenceListResponse> {
    return this.units.replacePreferences(applicationId, input);
  }
}
