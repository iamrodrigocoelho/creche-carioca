import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@match/database';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { apiErrorSchema, locationAnchorListSchema } from '@match/schemas';

import { ensureSeed, resetTransactionalData, testPrismaClient } from '../../test/database';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { loadEnv } from '../common/config/env';
import { allSectors } from '@match/geo';

/**
 * Pontos de referencia contra PostgreSQL real (PRD 14.3, RF-02).
 *
 * Os CEPs saem da propria referencia de geocodificacao: um deles resolve, o
 * outro nao. Fixar valores no codigo faria a suite depender de a referencia
 * nunca mudar.
 */
const SETOR_CONHECIDO = Object.keys(allSectors())[0] as string;
const CEP_RESOLVIVEL = `${SETOR_CONHECIDO}000`;
const CEP_SEM_SETOR = '99999000';

describe('API de pontos de referencia', () => {
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

  const residencia = { cep: CEP_RESOLVIVEL, kind: 'RESIDENCIA' as const };

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

  describe('POST /applications/:id/location-anchors', () => {
    it('grava a residencia com coordenada e incerteza declarada', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ ...residencia, label: 'Casa' })
        .expect(201);

      const body = locationAnchorListSchema.parse(response.body);
      expect(body.hasResidence).toBe(true);
      expect(body.anchors).toHaveLength(1);

      const anchor = body.anchors[0];
      expect(anchor).toMatchObject({ position: 1, kind: 'RESIDENCIA', cep: CEP_RESOLVIVEL });
      expect(anchor?.status).toBe('RESOLVIDO');
      expect(anchor?.latitude).not.toBeNull();
      // A estimativa nunca e publicada sem a incerteza junto (PRD 8.5).
      expect(anchor?.precisionKm).toBeGreaterThan(0);
      expect(anchor?.lastValidatedAt).not.toBeNull();
    });

    it('aceita CEP formatado e guarda oito digitos', async () => {
      const id = await criarInscricao();
      const formatado = `${CEP_RESOLVIVEL.slice(0, 5)}-${CEP_RESOLVIVEL.slice(5)}`;

      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: formatado, kind: 'RESIDENCIA' })
        .expect(201);

      expect(response.body.anchors[0].cep).toBe(CEP_RESOLVIVEL);
    });

    /**
     * PRD 8.2: falhar a geocodificacao nao pode travar a inscricao. O ponto e
     * gravado com o bairro em aberto, e a familia segue pela busca textual.
     */
    it('grava o ponto mesmo quando a geocodificacao falha', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: CEP_SEM_SETOR, kind: 'RESIDENCIA' })
        .expect(201);

      const anchor = response.body.anchors[0];
      expect(anchor.status).toBe('FALHOU');
      expect(anchor.latitude).toBeNull();
      expect(anchor.precisionKm).toBeNull();
      expect(response.body.hasResidence).toBe(true);
    });

    it('usa a primeira posicao livre quando a posicao e omitida', async () => {
      const id = await criarInscricao();
      await request(http).post(`/applications/${id}/location-anchors`).send(residencia).expect(201);

      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: CEP_RESOLVIVEL, kind: 'TRABALHO' })
        .expect(201);

      expect(response.body.anchors.map((a: { position: number }) => a.position)).toEqual([1, 2]);
    });

    it('sinaliza CEP duplicado sem recusar', async () => {
      const id = await criarInscricao();
      await request(http).post(`/applications/${id}/location-anchors`).send(residencia).expect(201);

      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: CEP_RESOLVIVEL, kind: 'TRABALHO' })
        .expect(201);

      const [primeiro, segundo] = response.body.anchors;
      expect(primeiro.duplicateOfPosition).toBeNull();
      expect(segundo.duplicateOfPosition).toBe(1);
    });

    it('corrige a residencia sem exigir remocao antes', async () => {
      const id = await criarInscricao();
      await request(http).post(`/applications/${id}/location-anchors`).send(residencia).expect(201);

      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: CEP_SEM_SETOR, kind: 'RESIDENCIA', position: 1 })
        .expect(201);

      expect(response.body.anchors).toHaveLength(1);
      expect(response.body.anchors[0].cep).toBe(CEP_SEM_SETOR);
    });

    it('recusa a quarta posicao', async () => {
      const id = await criarInscricao();
      await request(http).post(`/applications/${id}/location-anchors`).send(residencia).expect(201);
      for (const kind of ['TRABALHO', 'REDE_APOIO']) {
        await request(http)
          .post(`/applications/${id}/location-anchors`)
          .send({ cep: CEP_RESOLVIVEL, kind })
          .expect(201);
      }

      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: CEP_RESOLVIVEL, kind: 'OUTRO' })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('ANCHOR_LIMIT_REACHED');
    });

    /** A posicao explicita e barrada no contrato, antes de chegar ao servico. */
    it('recusa posicao 1 com tipo diferente de residencia, ja na validacao', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: CEP_RESOLVIVEL, kind: 'TRABALHO', position: 1 })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
    });

    /**
     * Sem posicao explicita o contrato nao tem como saber que a vaga livre e a
     * primeira; quem barra e o servico. Os dois caminhos precisam existir.
     */
    it('recusa o primeiro ponto quando nao e a residencia', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: CEP_RESOLVIVEL, kind: 'TRABALHO' })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('ANCHOR_POSITION_MISMATCH');
    });

    it('recusa CEP invalido com mensagem em linguagem simples', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: 'abc', kind: 'RESIDENCIA' })
        .expect(400);

      expect(JSON.stringify(response.body)).toMatch(/8 dígitos/);
    });

    it('responde 404 para inscricao inexistente', async () => {
      await request(http)
        .post('/applications/11111111-1111-4111-8111-111111111111/location-anchors')
        .send(residencia)
        .expect(404);
    });
  });

  describe('DELETE /applications/:id/location-anchors/:position', () => {
    it('remove um ponto opcional', async () => {
      const id = await criarInscricao();
      await request(http).post(`/applications/${id}/location-anchors`).send(residencia).expect(201);
      await request(http)
        .post(`/applications/${id}/location-anchors`)
        .send({ cep: CEP_RESOLVIVEL, kind: 'TRABALHO' })
        .expect(201);

      const response = await request(http)
        .delete(`/applications/${id}/location-anchors/2`)
        .expect(200);

      expect(response.body.anchors).toHaveLength(1);
      expect(response.body.hasResidence).toBe(true);
    });

    /** PRD 8.2: o CEP de residencia e obrigatorio. */
    it('recusa remover a residencia', async () => {
      const id = await criarInscricao();
      await request(http).post(`/applications/${id}/location-anchors`).send(residencia).expect(201);

      const response = await request(http)
        .delete(`/applications/${id}/location-anchors/1`)
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('RESIDENCE_ANCHOR_REQUIRED');
    });

    it('responde 404 ao remover posicao vazia', async () => {
      const id = await criarInscricao();
      await request(http).delete(`/applications/${id}/location-anchors/3`).expect(404);
    });
  });

  describe('trilha e privacidade', () => {
    it('audita a gravacao sem guardar o CEP inteiro (PRD 8.16, 13.4)', async () => {
      const id = await criarInscricao();
      await request(http).post(`/applications/${id}/location-anchors`).send(residencia).expect(201);

      const evento = await prisma.auditEvent.findFirst({
        where: { entity: 'LocationAnchor', action: 'LOCATION_ANCHOR_UPSERT' },
      });

      expect(evento).not.toBeNull();
      expect(evento?.correlationId).toBeTruthy();
      const metadata = JSON.stringify(evento?.metadata);
      expect(metadata).not.toContain(CEP_RESOLVIVEL);
      expect(metadata).toContain('REDACTED');
    });

    it('os pontos nao alteram o grupamento nem a pontuacao (PRD 8.2)', async () => {
      const id = await criarInscricao();
      const antes = await request(http).get(`/applications/${id}`).expect(200);
      await request(http).post(`/applications/${id}/location-anchors`).send(residencia).expect(201);
      const depois = await request(http).get(`/applications/${id}`).expect(200);

      expect(depois.body.ageGroup).toEqual(antes.body.ageGroup);
    });
  });

  describe('GET /neighborhoods', () => {
    it('lista os bairros para a busca textual de PRD 8.2', async () => {
      const response = await request(http).get('/neighborhoods').expect(200);
      expect(response.body.neighborhoods.length).toBeGreaterThan(100);
    });
  });
});
