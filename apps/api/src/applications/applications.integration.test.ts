import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@match/database';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { applicationSchema, apiErrorSchema } from '@match/schemas';

import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { loadEnv } from '../common/config/env';
import { ensureSeed, resetTransactionalData, testPrismaClient } from '../../test/database';

/**
 * Testes de integracao HTTP.
 *
 * PRD 14.3 exige "API com PostgreSQL real". A suite sobe a aplicacao Nest
 * completa (middleware de correlation ID, pipes, filtro de excecao e hardening)
 * contra o banco de teste, sem qualquer mock de persistencia.
 */

const validBody = {
  processId: 'DEMO-2026',
  child: { birthYear: 2024, birthMonth: 3 },
  desiredShift: 'INTEGRAL',
};

describe('API de inscricoes', () => {
  let app: INestApplication;
  let http: string;
  let prisma: PrismaClient;

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

  describe('GET /health', () => {
    it('responde liveness', async () => {
      const response = await request(http).get('/health/live').expect(200);

      expect(response.body.status).toBe('ok');
      expect(typeof response.body.uptimeSeconds).toBe('number');
    });

    it('trata o PostgreSQL como dependencia critica e disponivel (PRD 16.4)', async () => {
      const response = await request(http).get('/health/ready').expect(200);

      expect(response.body.status).toBe('ready');
      const postgres = response.body.checks.find(
        (check: { name: string }) => check.name === 'postgres',
      );
      expect(postgres).toMatchObject({ status: 'up', critical: true });
    });

    it('mantem o Redis como dependencia opcional simulada (PRD 16.4)', async () => {
      const response = await request(http).get('/health/ready').expect(200);

      const redis = response.body.checks.find((check: { name: string }) => check.name === 'redis');
      expect(redis).toMatchObject({ status: 'skipped', critical: false });
    });
  });

  describe('POST /applications', () => {
    it('cria a inscricao e devolve o grupamento calculado', async () => {
      const response = await request(http).post('/applications').send(validBody).expect(201);

      const parsed = applicationSchema.parse(response.body);
      expect(parsed.status).toBe('RASCUNHO');
      expect(parsed.ageGroup.code).toBe('MATERNAL_I');
      expect(parsed.ageGroup.ageInMonths).toBe(24);
      expect(parsed.ageGroup.explanation.length).toBeGreaterThan(0);
    });

    it('marca a regra aplicada como demonstracao (PRD 1.2)', async () => {
      const response = await request(http).post('/applications').send(validBody).expect(201);

      expect(response.body.ageGroup.policy.status).toBe('DEMONSTRACAO');
    });

    it('gera identificadores nao sequenciais e distintos (PRD 13.5)', async () => {
      const first = await request(http).post('/applications').send(validBody).expect(201);
      const second = await request(http).post('/applications').send(validBody).expect(201);

      expect(first.body.id).not.toBe(second.body.id);
      expect(first.body.anonymousChildId).not.toBe(first.body.id);
    });

    it('devolve o correlation ID no cabecalho e no erro (PRD 16.1)', async () => {
      const response = await request(http)
        .post('/applications')
        .send({ ...validBody, desiredShift: 'NOTURNO' })
        .expect(400);

      expect(response.headers['x-correlation-id']).toBeTruthy();
      expect(apiErrorSchema.parse(response.body).error.correlationId).toBeTruthy();
    });

    it('rejeita entrada invalida com issues por campo, sem ecoar o valor recebido', async () => {
      const response = await request(http)
        .post('/applications')
        .send({ ...validBody, child: { birthYear: 2024, birthMonth: 99 } })
        .expect(400);

      const body = apiErrorSchema.parse(response.body);
      expect(body.error.code).toBe('VALIDATION_FAILED');
      expect(body.error.issues?.[0]?.path).toBe('child.birthMonth');

      // O `correlationId` e um UUID aleatorio: ele nao deriva da entrada, mas
      // pode conter '99' por acaso, o que reprovaria este teste sem que a API
      // tivesse ecoado nada. Só os campos que carregam texto derivado da
      // requisicao entram na verificacao de eco (PRD 13.5).
      const { correlationId: _correlationId, ...echoable } = body.error;
      expect(JSON.stringify(echoable)).not.toContain('99');
    });

    it('nao expoe stack trace (PRD 13.5)', async () => {
      const response = await request(http).post('/applications').send({}).expect(400);

      expect(JSON.stringify(response.body)).not.toMatch(/at .+\(.+:\d+:\d+\)/);
      expect(response.body.error).not.toHaveProperty('stack');
    });

    it('recusa processo seletivo desconhecido', async () => {
      const response = await request(http)
        .post('/applications')
        .send({ ...validBody, processId: 'INEXISTENTE' })
        .expect(400);

      expect(response.body.error.code).toBe('UNKNOWN_PROCESS');
    });
  });

  describe('Idempotencia (PRD 12.4)', () => {
    it('replica a mesma resposta para a mesma chave', async () => {
      const key = 'chave-idempotente-001';

      const first = await request(http)
        .post('/applications')
        .set('Idempotency-Key', key)
        .send(validBody)
        .expect(201);

      const second = await request(http)
        .post('/applications')
        .set('Idempotency-Key', key)
        .send(validBody)
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
    });

    it('cria inscricoes distintas para chaves distintas', async () => {
      const first = await request(http)
        .post('/applications')
        .set('Idempotency-Key', 'chave-distinta-a')
        .send(validBody)
        .expect(201);

      const second = await request(http)
        .post('/applications')
        .set('Idempotency-Key', 'chave-distinta-b')
        .send(validBody)
        .expect(201);

      expect(second.body.id).not.toBe(first.body.id);
    });

    it('rejeita chave de idempotencia fora do formato seguro', async () => {
      const response = await request(http)
        .post('/applications')
        .set('Idempotency-Key', 'curta')
        .send(validBody)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_IDEMPOTENCY_KEY');
    });
  });

  describe('GET /applications/:id', () => {
    it('recupera a inscricao criada', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);
      const fetched = await request(http).get(`/applications/${created.body.id}`).expect(200);

      expect(fetched.body).toEqual(created.body);
    });

    it('responde 404 para identificador inexistente', async () => {
      const response = await request(http)
        .get('/applications/11111111-1111-4111-8111-111111111111')
        .expect(404);

      expect(response.body.error.code).toBe('APPLICATION_NOT_FOUND');
    });

    it('recusa identificador que nao seja UUID v4, evitando enumeracao', async () => {
      await request(http).get('/applications/1').expect(400);
    });
  });

  describe('PATCH /applications/:id (PRD 8.1 - recalculo)', () => {
    it('recalcula o grupamento quando o nascimento muda', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);
      expect(created.body.ageGroup.code).toBe('MATERNAL_I');

      const patched = await request(http)
        .patch(`/applications/${created.body.id}`)
        .send({ child: { birthMonth: 4, birthYear: 2024 } })
        .expect(200);

      expect(patched.body.ageGroup.code).toBe('BERCARIO_II');
      expect(patched.body.id).toBe(created.body.id);
    });

    it('recalcula o grupamento quando a data de referencia muda', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);

      const patched = await request(http)
        .patch(`/applications/${created.body.id}`)
        .send({ referenceDate: '2027-03-31' })
        .expect(200);

      expect(patched.body.ageGroup.code).toBe('MATERNAL_II');
      expect(patched.body.ageGroup.referenceDate).toBe('2027-03-31');
    });

    it('rejeita corpo vazio', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);

      await request(http).patch(`/applications/${created.body.id}`).send({}).expect(400);
    });

    it('responde 404 ao atualizar inscricao inexistente', async () => {
      await request(http)
        .patch('/applications/11111111-1111-4111-8111-111111111111')
        .send({ desiredShift: 'PARCIAL' })
        .expect(404);
    });
  });

  describe('Hardening (PRD 13.5)', () => {
    it('define cabecalhos de seguranca', async () => {
      const response = await request(http).get('/health/live').expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('nao devolve permissao de CORS para origem fora da allowlist', async () => {
      const response = await request(http)
        .get('/health/live')
        .set('Origin', 'https://atacante.example')
        .expect(200);

      // O middleware de CORS responde `false` para origem nao permitida; o que
      // importa e que a origem do atacante nunca seja refletida de volta.
      expect(response.headers['access-control-allow-origin']).not.toBe('https://atacante.example');
    });

    it('aceita origem da allowlist', async () => {
      const response = await request(http)
        .get('/health/live')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('rejeita payload acima do limite configurado', async () => {
      await request(http)
        .post('/applications')
        .send({ ...validBody, padding: 'x'.repeat(400_000) })
        .expect(413);
    });
  });
});
