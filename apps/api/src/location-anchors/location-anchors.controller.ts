import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';

import {
  createLocationAnchorSchema,
  type CreateLocationAnchorParsed,
  type LocationAnchorListResponse,
  type NeighborhoodListResponse,
} from '@match/schemas';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LocationAnchorsService } from './location-anchors.service';

/**
 * Pontos de referencia da inscricao (RF-02, PRD 12.4).
 *
 * Toda resposta devolve a lista inteira, e nao apenas o ponto tocado: a
 * interface precisa reavaliar duplicidade e a presenca da residencia a cada
 * mudanca, e um retorno parcial a obrigaria a uma segunda chamada.
 */
@Controller()
export class LocationAnchorsController {
  constructor(private readonly anchors: LocationAnchorsService) {}

  @Get('applications/:id/location-anchors')
  async list(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
  ): Promise<LocationAnchorListResponse> {
    return this.anchors.list(applicationId);
  }

  @Post('applications/:id/location-anchors')
  async upsert(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Body(new ZodValidationPipe(createLocationAnchorSchema)) input: CreateLocationAnchorParsed,
  ): Promise<LocationAnchorListResponse> {
    return this.anchors.upsert(applicationId, input);
  }

  @Delete('applications/:id/location-anchors/:position')
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Param('position', ParseIntPipe) position: number,
  ): Promise<LocationAnchorListResponse> {
    return this.anchors.remove(applicationId, position);
  }

  /**
   * Bairros conhecidos. PRD 8.2 exige que a familia consiga escolher unidades
   * por bairro quando a geocodificacao falha, e a lista vem da mesma referencia
   * usada pelo provider, para nao divergir.
   */
  @Get('neighborhoods')
  listNeighborhoods(): NeighborhoodListResponse {
    return { neighborhoods: [...this.anchors.listNeighborhoods()] };
  }
}
