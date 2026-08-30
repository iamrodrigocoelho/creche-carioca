import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@match/database';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  apiErrorSchema,
  criterionListSchema,
  scoreHistorySchema,
  scoreResultSchema,
} from '@match/schemas';

import { ensureSeed, resetTransactionalData, testPrismaClient } from '../../test/database';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { loadEnv } from '../common/config/env';

/**
 * Pontuação contra PostgreSQL real (PRD 14.3, RF-07).
 *
 * A régua vem do seed: a de 2025, oficial, com 100 pontos em 11 critérios
 * pontuados e 2 de desempate.
 */
describe('API de pontuação', () => {
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

  async function criterios(id: string) {
    const response = await request(http).get(`/applications/${id}/criteria`).expect(200);
    return criterionListSchema.parse(response.body);
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

  describe('GET /applications/:id/criteria', () => {
    it('devolve a régua vigente com a versão da regra', async () => {
      const lista = await criterios(await criarInscricao());

      expect(lista.criteria).toHaveLength(13);
      expect(lista.criteria.filter((c) => c.isTiebreak)).toHaveLength(2);
      expect(lista.rule.version).toBe(1);
      // PRD 1.2: a régua é oficial, mas a escolha de usá-la em 2026 é demonstração.
      expect(lista.rule.status).toBe('DEMONSTRACAO');
      expect(lista.rule.sourceYear).toBe(2025);
    });

    it('a régua pontuada soma exatamente cem pontos', async () => {
      const lista = await criterios(await criarInscricao());
      const total = lista.criteria.reduce((soma, item) => soma + item.points, 0);
      expect(total).toBe(100);
    });

    it('começa sem respostas e incompleta', async () => {
      const lista = await criterios(await criarInscricao());
      expect(lista.criteria.every((c) => c.answer === null)).toBe(true);
      expect(lista.isComplete).toBe(false);
    });

    it('responde 404 para inscrição inexistente', async () => {
      await request(http)
        .get('/applications/11111111-1111-4111-8111-111111111111/criteria')
        .expect(404);
    });
  });

  describe('PUT /applications/:id/criteria', () => {
    it('soma o peso do critério respondido afirmativamente', async () => {
      const id = await criarInscricao();
      const lista = await criterios(id);
      const cadUnico = lista.criteria.find((c) => c.points === 51);

      const response = await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: cadUnico?.code, answer: true }] })
        .expect(200);

      const resultado = scoreResultSchema.parse(response.body);
      expect(resultado.total).toBe(51);
      expect(resultado.maxTotal).toBe(100);
    });

    it('não soma nada quando tudo é negativo', async () => {
      const id = await criarInscricao();
      const lista = await criterios(id);

      const response = await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: lista.criteria.map((c) => ({ code: c.code, answer: false })) })
        .expect(200);

      expect(scoreResultSchema.parse(response.body).total).toBe(0);
    });

    it('chega a cem quando tudo é afirmativo', async () => {
      const id = await criarInscricao();
      const lista = await criterios(id);

      const response = await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: lista.criteria.map((c) => ({ code: c.code, answer: true })) })
        .expect(200);

      expect(scoreResultSchema.parse(response.body).total).toBe(100);
    });

    /** A família responde aos poucos; responder uma não pode apagar as outras. */
    it('preserva respostas anteriores ao registrar novas', async () => {
      const id = await criarInscricao();
      const lista = await criterios(id);
      const [primeiro, segundo] = lista.criteria.filter((c) => !c.isTiebreak);

      await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: primeiro?.code, answer: true }] })
        .expect(200);

      const response = await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: segundo?.code, answer: true }] })
        .expect(200);

      const total = (primeiro?.points ?? 0) + (segundo?.points ?? 0);
      expect(scoreResultSchema.parse(response.body).total).toBe(total);
    });

    it('permite corrigir uma resposta já dada', async () => {
      const id = await criarInscricao();
      const cadUnico = (await criterios(id)).criteria.find((c) => c.points === 51);

      await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: cadUnico?.code, answer: true }] })
        .expect(200);

      const response = await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: cadUnico?.code, answer: false }] })
        .expect(200);

      expect(scoreResultSchema.parse(response.body).total).toBe(0);
    });

    it('critério de desempate não soma pontos', async () => {
      const id = await criarInscricao();
      const desempate = (await criterios(id)).criteria.find((c) => c.isTiebreak);

      const response = await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: desempate?.code, answer: true }] })
        .expect(200);

      const resultado = scoreResultSchema.parse(response.body);
      expect(resultado.total).toBe(0);
      expect(resultado.tiebreaks.find((t) => t.code === desempate?.code)?.applies).toBe(true);
    });

    it('recusa critério que não existe na régua', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: 99999, answer: true }] })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('UNKNOWN_CRITERION');
    });

    it('recusa o mesmo critério duas vezes', async () => {
      const id = await criarInscricao();
      const codigo = (await criterios(id)).criteria[0]?.code;

      await request(http)
        .put(`/applications/${id}/criteria`)
        .send({
          responses: [
            { code: codigo, answer: true },
            { code: codigo, answer: false },
          ],
        })
        .expect(400);
    });
  });

  describe('explicação estruturada (PRD 8.7)', () => {
    it('detalha cada critério com peso, pontos e o motivo', async () => {
      const id = await criarInscricao();
      const lista = await criterios(id);
      const cadUnico = lista.criteria.find((c) => c.points === 51);

      const response = await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: cadUnico?.code, answer: true }] })
        .expect(200);

      const resultado = scoreResultSchema.parse(response.body);
      const linha = resultado.lines.find((l) => l.code === cadUnico?.code);
      expect(linha).toMatchObject({ weight: 51, awarded: 51, outcome: 'PONTUOU', answer: true });

      // Os não respondidos aparecem, e como não respondidos.
      expect(resultado.lines.some((l) => l.outcome === 'NAO_RESPONDIDA')).toBe(true);
    });

    it('separa linhas de pontuação dos critérios de desempate', async () => {
      const id = await criarInscricao();
      const response = await request(http).post(`/applications/${id}/score-runs`).expect(201);

      const resultado = scoreResultSchema.parse(response.body);
      expect(resultado.lines).toHaveLength(11);
      expect(resultado.tiebreaks).toHaveLength(2);
      expect(resultado.lines.every((l) => l.weight > 0)).toBe(true);
    });
  });

  describe('imutabilidade do resultado (PRD 8.7)', () => {
    it('cada cálculo grava um resultado novo, sem tocar nos anteriores', async () => {
      const id = await criarInscricao();
      const cadUnico = (await criterios(id)).criteria.find((c) => c.points === 51);

      await request(http).post(`/applications/${id}/score-runs`).expect(201);
      await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: cadUnico?.code, answer: true }] })
        .expect(200);

      const response = await request(http).get(`/applications/${id}/score-runs`).expect(200);
      const historico = scoreHistorySchema.parse(response.body);

      expect(historico.results.length).toBeGreaterThanOrEqual(2);
      // Do mais recente ao mais antigo: o primeiro cálculo, com zero, permanece.
      expect(historico.results[0]?.total).toBe(51);
      expect(historico.results.at(-1)?.total).toBe(0);
    });

    it('o banco recusa alterar um resultado gravado', async () => {
      const id = await criarInscricao();
      await request(http).post(`/applications/${id}/score-runs`).expect(201);
      const linha = await prisma.scoreResult.findFirstOrThrow({ where: { applicationId: id } });

      await expect(
        prisma.scoreResult.update({ where: { id: linha.id }, data: { total: 999 } }),
      ).rejects.toThrow(/append-only/i);
    });

    it('o banco recusa apagar um resultado gravado', async () => {
      const id = await criarInscricao();
      await request(http).post(`/applications/${id}/score-runs`).expect(201);
      const linha = await prisma.scoreResult.findFirstOrThrow({ where: { applicationId: id } });

      await expect(prisma.scoreResult.delete({ where: { id: linha.id } })).rejects.toThrow(
        /append-only/i,
      );
    });

    it('guarda o detalhamento junto do resultado, reproduzindo-o sem recalcular', async () => {
      const id = await criarInscricao();
      const cadUnico = (await criterios(id)).criteria.find((c) => c.points === 51);
      await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: cadUnico?.code, answer: true }] })
        .expect(200);

      const linha = await prisma.scoreResult.findFirstOrThrow({
        where: { applicationId: id },
        orderBy: { computedAt: 'desc' },
      });
      const breakdown = linha.breakdown as unknown as {
        lines: { code: number; awarded: number }[];
        rule: { version: number; sourceYear: number };
      };

      expect(breakdown.rule.version).toBe(1);
      expect(breakdown.rule.sourceYear).toBe(2025);
      expect(breakdown.lines.find((l) => l.code === cadUnico?.code)?.awarded).toBe(51);
    });
  });

  describe('determinismo (PRD 1.2)', () => {
    it('a mesma entrada e a mesma regra produzem o mesmo total', async () => {
      const id = await criarInscricao();
      const lista = await criterios(id);
      await request(http)
        .put(`/applications/${id}/criteria`)
        .send({
          responses: lista.criteria.slice(0, 4).map((c) => ({ code: c.code, answer: true })),
        })
        .expect(200);

      const primeiro = await request(http).post(`/applications/${id}/score-runs`).expect(201);
      const segundo = await request(http).post(`/applications/${id}/score-runs`).expect(201);

      expect(scoreResultSchema.parse(segundo.body).total).toBe(
        scoreResultSchema.parse(primeiro.body).total,
      );
      expect(segundo.body.lines).toEqual(primeiro.body.lines);
    });
  });

  describe('trilha e privacidade', () => {
    it('audita o cálculo sem guardar as respostas (PRD 8.16)', async () => {
      const id = await criarInscricao();
      const cadUnico = (await criterios(id)).criteria.find((c) => c.points === 51);
      await request(http)
        .put(`/applications/${id}/criteria`)
        .send({ responses: [{ code: cadUnico?.code, answer: true }] })
        .expect(200);

      const evento = await prisma.auditEvent.findFirst({
        where: { entity: 'ScoreResult', action: 'SCORE_COMPUTED' },
      });
      expect(evento).not.toBeNull();
      expect(evento?.correlationId).toBeTruthy();

      const respostas = await prisma.auditEvent.findFirst({
        where: { action: 'CRITERION_RESPONSES_REPLACE' },
      });
      // Só a contagem sobrevive: as respostas são dado sensível.
      expect(JSON.stringify(respostas?.metadata)).not.toContain('answer');
    });

    it('a pontuação não altera o grupamento', async () => {
      const id = await criarInscricao();
      const antes = await request(http).get(`/applications/${id}`).expect(200);
      await request(http).post(`/applications/${id}/score-runs`).expect(201);
      const depois = await request(http).get(`/applications/${id}`).expect(200);

      expect(depois.body.ageGroup).toEqual(antes.body.ageGroup);
    });
  });
});
