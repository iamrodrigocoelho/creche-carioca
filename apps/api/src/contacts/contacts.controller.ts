import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';

import {
  createPhoneContactSchema,
  createSocialContactSchema,
  verifyContactSchema,
  type ContactChallengeResponse,
  type ContactListResponse,
  type CreatePhoneContactParsed,
  type CreateSocialContactParsed,
  type VerifyContactInput,
} from '@match/schemas';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ContactsService } from './contacts.service';

/**
 * Contatos da inscricao (RF-03, RF-04).
 *
 * Telefone e rede social tem endpoints separados porque os campos obrigatorios e
 * os consentimentos sao diferentes — um schema unico com metade dos campos
 * opcionais aceitaria combinacoes sem sentido.
 *
 * Toda resposta devolve a lista inteira: a interface precisa reavaliar o
 * principal, a duplicidade e a presenca de telefone a cada mudanca.
 */
@Controller('applications/:id/contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  async list(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
  ): Promise<ContactListResponse> {
    return this.contacts.list(applicationId);
  }

  @Post('phones')
  async addPhone(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Body(new ZodValidationPipe(createPhoneContactSchema)) input: CreatePhoneContactParsed,
  ): Promise<ContactListResponse> {
    return this.contacts.addPhone(applicationId, input);
  }

  @Post('social')
  async addSocial(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Body(new ZodValidationPipe(createSocialContactSchema)) input: CreateSocialContactParsed,
  ): Promise<ContactListResponse> {
    return this.contacts.addSocial(applicationId, input);
  }

  @Put(':contactId/primary')
  async setPrimary(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Param('contactId', new ParseUUIDPipe({ version: '4' })) contactId: string,
  ): Promise<ContactListResponse> {
    return this.contacts.setPrimary(applicationId, contactId);
  }

  @Delete(':contactId')
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Param('contactId', new ParseUUIDPipe({ version: '4' })) contactId: string,
  ): Promise<ContactListResponse> {
    return this.contacts.remove(applicationId, contactId);
  }

  /** Abre o desafio simulado. O codigo volta no corpo porque nada e enviado (B-06). */
  @Post(':contactId/verification')
  async startVerification(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Param('contactId', new ParseUUIDPipe({ version: '4' })) contactId: string,
  ): Promise<ContactChallengeResponse> {
    return this.contacts.startVerification(applicationId, contactId);
  }

  @Put(':contactId/verification')
  async confirmVerification(
    @Param('id', new ParseUUIDPipe({ version: '4' })) applicationId: string,
    @Param('contactId', new ParseUUIDPipe({ version: '4' })) contactId: string,
    @Body(new ZodValidationPipe(verifyContactSchema)) input: VerifyContactInput,
  ): Promise<ContactListResponse> {
    return this.contacts.confirmVerification(applicationId, contactId, input);
  }
}
