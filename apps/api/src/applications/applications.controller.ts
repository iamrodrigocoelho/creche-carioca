import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UsePipes,
} from '@nestjs/common';

import {
  createApplicationSchema,
  updateApplicationSchema,
  type ApplicationResponse,
  type CreateApplicationInput,
  type UpdateApplicationInput,
} from '@match/schemas';

import { IDEMPOTENCY_HEADER, IdempotencyStore } from '../common/idempotency/idempotency.store';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ApplicationsService } from './applications.service';

/**
 * Endpoints de inscricao previstos em PRD 12.4.
 *
 * A autorizacao por perfil e escopo territorial (PRD 13.3) entra na Fase 10,
 * junto com a autenticacao simulada. Ate la estes endpoints operam apenas sobre
 * dados sinteticos de demonstracao, sem qualquer dado pessoal real (PRD 1.2).
 */
@Controller('applications')
export class ApplicationsController {
  constructor(
    private readonly applications: ApplicationsService,
    private readonly idempotency: IdempotencyStore,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(createApplicationSchema))
  async create(
    @Body() input: CreateApplicationInput,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey?: string,
  ): Promise<ApplicationResponse> {
    if (!idempotencyKey) {
      return this.applications.create(input);
    }

    IdempotencyStore.assertValidKey(idempotencyKey);

    const replayed = this.idempotency.get<ApplicationResponse>(
      'POST /applications',
      idempotencyKey,
    );
    if (replayed) return replayed;

    const created = await this.applications.create(input);
    this.idempotency.set('POST /applications', idempotencyKey, created);
    return created;
  }

  @Get(':id')
  async findById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ApplicationResponse> {
    return this.applications.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(updateApplicationSchema)) input: UpdateApplicationInput,
  ): Promise<ApplicationResponse> {
    return this.applications.update(id, input);
  }
}
