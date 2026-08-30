import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@match/database';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { apiErrorSchema, contactListSchema } from '@match/schemas';

import { ensureSeed, resetTransactionalData, testPrismaClient } from '../../test/database';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { loadEnv } from '../common/config/env';

/**
 * Contatos contra PostgreSQL real (PRD 14.3, RF-03, RF-04).
 */
const CELULAR = '(21) 98765-4321';
const CELULAR_E164 = '+5521987654321';
const OUTRO_CELULAR = '(21) 91234-5678';
const FIXO = '(21) 3333-4444';

describe('API de contatos', () => {
  let app: INestApplication;
  let http: string;
  let prisma: PrismaClient;

  async function criarInscricao(): Promise<string> {
    const response = await request(http)
      .post('/applications')
      .send({
        processId: 'DEMO-2026',
        child: { birthYear: 2024, birthMonth: 3 },
        desiredShift: 'INTEGRAL',
      })
      .expect(201);
    return response.body.id as string;
  }

  async function comTelefone(id: string, phone = CELULAR): Promise<string> {
    const response = await request(http)
      .post(`/applications/${id}/contacts/phones`)
      .send({ phone, relation: 'MAE' })
      .expect(201);
    return response.body.contacts[0].id as string;
  }

  beforeAll(async () => {
    prisma = testPrismaClient();
    await ensureSeed(prisma);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, loadEnv({ ...process.env, NODE_ENV: 'test' }));
    await app.init();
    await app.listen(0);
    http = await app.getUrl();
  });

  beforeEach(async () => {
    await resetTransactionalData(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('telefones', () => {
    it('normaliza para E.164 e devolve mascarado', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/contacts/phones`)
        .send({ phone: CELULAR, relation: 'MAE', label: 'Celular da mãe' })
        .expect(201);

      const body = contactListSchema.parse(response.body);
      const contato = body.contacts[0];
      expect(contato?.masked).toBe('(21) •••••-4321');
      expect(contato?.isPrimary).toBe(true);
      expect(body.hasReachableContact).toBe(true);

      // PRD 13.4: o valor completo nunca sai da API.
      expect(JSON.stringify(body)).not.toContain('98765');
      expect(JSON.stringify(body)).not.toContain(CELULAR_E164);
    });

    it('guarda E.164 no banco, e nao o que foi digitado', async () => {
      const id = await criarInscricao();
      await comTelefone(id);

      const row = await prisma.contactPoint.findFirstOrThrow({ where: { applicationId: id } });
      expect(row.e164).toBe(CELULAR_E164);
      expect(row.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    });

    it('recusa telefone que não é brasileiro válido', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/contacts/phones`)
        .send({ phone: '20987654321', relation: 'MAE' })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('recusa SMS e WhatsApp em telefone fixo', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/contacts/phones`)
        .send({ phone: FIXO, relation: 'MAE', allowsSms: true })
        .expect(400);

      expect(JSON.stringify(response.body)).toMatch(/celular/i);
    });

    /** PRD 8.3: telefone de terceiro exige relação e autorização. */
    it('recusa telefone de terceiro sem autorização confirmada', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/contacts/phones`)
        .send({ phone: CELULAR, relation: 'VIZINHO' })
        .expect(400);

      expect(JSON.stringify(response.body)).toMatch(/autorizou/i);
    });

    it('aceita telefone de terceiro com autorização confirmada', async () => {
      const id = await criarInscricao();
      await request(http)
        .post(`/applications/${id}/contacts/phones`)
        .send({ phone: CELULAR, relation: 'VIZINHO', thirdPartyAuthorized: true })
        .expect(201);
    });

    it('sinaliza telefone repetido sem recusar', async () => {
      const id = await criarInscricao();
      const primeiro = await comTelefone(id);
      const response = await request(http)
        .post(`/applications/${id}/contacts/phones`)
        .send({ phone: CELULAR_E164, relation: 'PAI' })
        .expect(201);

      const body = contactListSchema.parse(response.body);
      expect(body.contacts).toHaveLength(2);
      expect(body.contacts[1]?.duplicateOfId).toBe(primeiro);
    });
  });

  describe('telefone principal (PRD 8.3)', () => {
    it('elege o primeiro telefone automaticamente', async () => {
      const id = await criarInscricao();
      await comTelefone(id);
      const response = await request(http).get(`/applications/${id}/contacts`).expect(200);
      expect(
        response.body.contacts.filter((c: { isPrimary: boolean }) => c.isPrimary),
      ).toHaveLength(1);
    });

    it('mantém exatamente um principal ao adicionar outros', async () => {
      const id = await criarInscricao();
      await comTelefone(id);
      await comTelefone(id, OUTRO_CELULAR);
      const response = await request(http)
        .post(`/applications/${id}/contacts/phones`)
        .send({ phone: FIXO, relation: 'PAI' })
        .expect(201);

      const principais = response.body.contacts.filter((c: { isPrimary: boolean }) => c.isPrimary);
      expect(principais).toHaveLength(1);
    });

    it('troca o principal desmarcando o anterior', async () => {
      const id = await criarInscricao();
      const primeiro = await comTelefone(id);
      await comTelefone(id, OUTRO_CELULAR);
      const lista = await request(http).get(`/applications/${id}/contacts`).expect(200);
      const segundo = lista.body.contacts.find((c: { id: string }) => c.id !== primeiro).id;

      const response = await request(http)
        .put(`/applications/${id}/contacts/${segundo}/primary`)
        .expect(200);

      const body = contactListSchema.parse(response.body);
      expect(body.contacts.find((c) => c.id === segundo)?.isPrimary).toBe(true);
      expect(body.contacts.filter((c) => c.isPrimary)).toHaveLength(1);
    });

    it('promove outro telefone quando o principal é removido', async () => {
      const id = await criarInscricao();
      const primeiro = await comTelefone(id);
      await comTelefone(id, OUTRO_CELULAR);

      const response = await request(http)
        .delete(`/applications/${id}/contacts/${primeiro}`)
        .expect(200);

      const body = contactListSchema.parse(response.body);
      expect(body.contacts).toHaveLength(1);
      expect(body.contacts[0]?.isPrimary).toBe(true);
    });

    it('recusa eleger perfil social como principal', async () => {
      const id = await criarInscricao();
      await comTelefone(id);
      const social = await request(http)
        .post(`/applications/${id}/contacts/social`)
        .send({ platform: 'INSTAGRAM', handle: '@maria.silva' })
        .expect(201);
      const socialId = social.body.contacts.find(
        (c: { channel: string }) => c.channel === 'SOCIAL',
      ).id;

      const response = await request(http)
        .put(`/applications/${id}/contacts/${socialId}/primary`)
        .expect(400);
      expect(apiErrorSchema.parse(response.body).error.code).toBe('PRIMARY_MUST_BE_PHONE');
    });
  });

  describe('remoção (PRD 8.3)', () => {
    it('recusa remover o único telefone', async () => {
      const id = await criarInscricao();
      const contato = await comTelefone(id);

      const response = await request(http)
        .delete(`/applications/${id}/contacts/${contato}`)
        .expect(400);
      expect(apiErrorSchema.parse(response.body).error.code).toBe('LAST_PHONE_CANNOT_BE_REMOVED');
    });

    it('recusa mesmo havendo perfis sociais', async () => {
      const id = await criarInscricao();
      const contato = await comTelefone(id);
      await request(http)
        .post(`/applications/${id}/contacts/social`)
        .send({ platform: 'INSTAGRAM', handle: 'maria' })
        .expect(201);

      await request(http).delete(`/applications/${id}/contacts/${contato}`).expect(400);
    });

    it('permite remover perfil social livremente', async () => {
      const id = await criarInscricao();
      await comTelefone(id);
      const social = await request(http)
        .post(`/applications/${id}/contacts/social`)
        .send({ platform: 'TIKTOK', handle: 'maria' })
        .expect(201);
      const socialId = social.body.contacts.find(
        (c: { channel: string }) => c.channel === 'SOCIAL',
      ).id;

      const response = await request(http)
        .delete(`/applications/${id}/contacts/${socialId}`)
        .expect(200);
      expect(response.body.contacts).toHaveLength(1);
    });
  });

  describe('redes sociais (PRD 8.4)', () => {
    it('normaliza o handle e devolve mascarado', async () => {
      const id = await criarInscricao();
      await comTelefone(id);
      const response = await request(http)
        .post(`/applications/${id}/contacts/social`)
        .send({ platform: 'INSTAGRAM', handle: '  @Maria.Silva ' })
        .expect(201);

      const social = contactListSchema
        .parse(response.body)
        .contacts.find((c) => c.channel === 'SOCIAL');
      expect(social?.masked).toBe('@Ma•••••••••');
      expect(JSON.stringify(response.body)).not.toContain('Maria.Silva');
    });

    /** PRD 8.4: rede social nunca pode ser o único contato. */
    it('avisa que falta telefone quando só há rede social', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/contacts/social`)
        .send({ platform: 'X', handle: 'maria' })
        .expect(201);

      expect(response.body.hasReachableContact).toBe(false);
    });

    it('exige data de consentimento quando autoriza contato', async () => {
      const id = await criarInscricao();
      await comTelefone(id);
      const response = await request(http)
        .post(`/applications/${id}/contacts/social`)
        .send({ platform: 'FACEBOOK', handle: 'maria', allowsSocial: true })
        .expect(201);

      const social = contactListSchema
        .parse(response.body)
        .contacts.find((c) => c.channel === 'SOCIAL');
      expect(social?.allowsSocial).toBe(true);
      expect(social?.consentedAt).not.toBeNull();
    });

    it('recusa handle com caractere de marcação', async () => {
      const id = await criarInscricao();
      await comTelefone(id);
      await request(http)
        .post(`/applications/${id}/contacts/social`)
        .send({ platform: 'INSTAGRAM', handle: '<script>alert(1)</script>' })
        .expect(400);
    });

    it('recusa rótulo com caractere de marcação', async () => {
      const id = await criarInscricao();
      await request(http)
        .post(`/applications/${id}/contacts/phones`)
        .send({ phone: CELULAR, relation: 'MAE', label: '<img src=x onerror=alert(1)>' })
        .expect(400);
    });
  });

  describe('verificação simulada (PRD 8.3)', () => {
    it('confirma o contato com o código devolvido', async () => {
      const id = await criarInscricao();
      const contato = await comTelefone(id);

      const desafio = await request(http)
        .post(`/applications/${id}/contacts/${contato}/verification`)
        .expect(201);
      expect(desafio.body.simulatedCode).toMatch(/^\d{6}$/);
      // PRD 1.2: a simulação precisa se anunciar como simulação.
      expect(desafio.body.notice).toMatch(/simulada/i);

      const confirmado = await request(http)
        .put(`/applications/${id}/contacts/${contato}/verification`)
        .send({ code: desafio.body.simulatedCode })
        .expect(200);

      const body = contactListSchema.parse(confirmado.body);
      expect(body.contacts[0]?.status).toBe('VERIFIED');
      expect(body.contacts[0]?.lastValidatedAt).not.toBeNull();
    });

    it('guarda o código apenas como hash (PRD 13.4)', async () => {
      const id = await criarInscricao();
      const contato = await comTelefone(id);
      const desafio = await request(http)
        .post(`/applications/${id}/contacts/${contato}/verification`)
        .expect(201);

      const row = await prisma.contactPoint.findUniqueOrThrow({ where: { id: contato } });
      expect(row.otpHash).toMatch(/^[0-9a-f]{64}$/);
      expect(row.otpHash).not.toContain(desafio.body.simulatedCode);
    });

    it('recusa código errado e conta a tentativa', async () => {
      const id = await criarInscricao();
      const contato = await comTelefone(id);
      await request(http).post(`/applications/${id}/contacts/${contato}/verification`).expect(201);

      const response = await request(http)
        .put(`/applications/${id}/contacts/${contato}/verification`)
        .send({ code: '000000' })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VERIFICATION_CODE_INVALID');
      const row = await prisma.contactPoint.findUniqueOrThrow({ where: { id: contato } });
      expect(row.otpAttempts).toBe(1);
    });

    it('recusa confirmar sem ter pedido código', async () => {
      const id = await criarInscricao();
      const contato = await comTelefone(id);

      const response = await request(http)
        .put(`/applications/${id}/contacts/${contato}/verification`)
        .send({ code: '123456' })
        .expect(400);
      expect(apiErrorSchema.parse(response.body).error.code).toBe('VERIFICATION_NOT_STARTED');
    });
  });

  describe('trilha e privacidade', () => {
    it('audita sem guardar o telefone completo (PRD 8.16, 13.4)', async () => {
      const id = await criarInscricao();
      await comTelefone(id);

      const evento = await prisma.auditEvent.findFirst({
        where: { entity: 'ContactPoint', action: 'CONTACT_CREATE' },
      });
      expect(evento).not.toBeNull();
      const metadata = JSON.stringify(evento?.metadata);
      expect(metadata).not.toContain('98765');
      expect(metadata).not.toContain(CELULAR_E164);
      expect(metadata).toContain('REDACTED');
    });

    it('os contatos não alteram o grupamento (PRD 8.3)', async () => {
      const id = await criarInscricao();
      const antes = await request(http).get(`/applications/${id}`).expect(200);
      await comTelefone(id);
      const depois = await request(http).get(`/applications/${id}`).expect(200);

      expect(depois.body.ageGroup).toEqual(antes.body.ageGroup);
    });

    it('responde 404 para inscrição inexistente', async () => {
      await request(http)
        .post('/applications/11111111-1111-4111-8111-111111111111/contacts/phones')
        .send({ phone: CELULAR, relation: 'MAE' })
        .expect(404);
    });
  });
});
