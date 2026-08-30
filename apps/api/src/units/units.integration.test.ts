import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@match/database';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { apiErrorSchema, preferenceListSchema, recommendationListSchema } from '@match/schemas';

import { ensureSeed, resetTransactionalData, testPrismaClient } from '../../test/database';
import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { loadEnv } from '../common/config/env';

/**
 * Recomendação e preferências contra PostgreSQL real (PRD 14.3, RF-05, RF-06).
 *
 * As unidades vêm do artefato versionado carregado pelo seed (ADR-0034), então
 * os testes rodam sobre as mesmas 872 unidades reais em qualquer ambiente.
 */
const CEP_CENTRO = '20060-000';

describe('API de unidades e preferências', () => {
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

  async function comAncora(id: string): Promise<void> {
    await request(http)
      .post(`/applications/${id}/location-anchors`)
      .send({ cep: CEP_CENTRO, kind: 'RESIDENCIA' })
      .expect(201);
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

  describe('GET /units/recommendations', () => {
    it('devolve o card com todos os campos de PRD 8.5', async () => {
      const id = await criarInscricao();
      await comAncora(id);

      const response = await request(http)
        .get('/units/recommendations')
        .query({ applicationId: id, limit: 5 })
        .expect(200);

      const body = recommendationListSchema.parse(response.body);
      expect(body.units.length).toBe(5);
      expect(body.hasAnchors).toBe(true);
      // PRD 8.5: dado histórico precisa ser rotulado como histórico.
      expect(body.historicalNotice).toMatch(/2021 a 2025/);

      const card = body.units[0];
      expect(card?.name).toBeTruthy();
      expect(card?.neighborhood).toBeTruthy();
      expect(card?.demandLevel).toMatch(/BAIXA|MEDIA|ALTA|MUITO_ALTA/);
      expect(card?.reasons.length).toBeGreaterThan(0);
      expect(card?.distances[0]?.distance.method).toBe('GEODESICA');
    });

    it('ordena da mais próxima para a mais distante', async () => {
      const id = await criarInscricao();
      await comAncora(id);

      const response = await request(http)
        .get('/units/recommendations')
        .query({ applicationId: id, limit: 20 })
        .expect(200);

      const distancias = recommendationListSchema
        .parse(response.body)
        .units.map((unit) => unit.nearestKm ?? Number.POSITIVE_INFINITY);
      expect([...distancias]).toEqual([...distancias].sort((a, b) => a - b));
    });

    /** PRD 8.5: a recomendação territorial não impede a escolha livre. */
    it('não descarta unidades distantes: o total cobre o catálogo inteiro', async () => {
      const id = await criarInscricao();
      await comAncora(id);

      const response = await request(http)
        .get('/units/recommendations')
        .query({ applicationId: id, limit: 5 })
        .expect(200);

      const body = recommendationListSchema.parse(response.body);
      expect(body.units).toHaveLength(5);
      expect(body.total).toBeGreaterThan(800);
    });

    it('funciona sem ponto de referência, ordenando por nome', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .get('/units/recommendations')
        .query({ applicationId: id, limit: 3 })
        .expect(200);

      const body = recommendationListSchema.parse(response.body);
      expect(body.hasAnchors).toBe(false);
      expect(body.units.every((unit) => unit.nearestKm === null)).toBe(true);
    });

    it('filtra por bairro, ignorando caixa', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .get('/units/recommendations')
        .query({ applicationId: id, neighborhood: 'santa teresa', limit: 50 })
        .expect(200);

      const body = recommendationListSchema.parse(response.body);
      expect(body.units.length).toBeGreaterThan(0);
      expect(body.units.every((u) => u.neighborhood?.toUpperCase() === 'SANTA TERESA')).toBe(true);
    });

    it('filtra por CRE', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .get('/units/recommendations')
        .query({ applicationId: id, cre: 1, limit: 50 })
        .expect(200);

      const body = recommendationListSchema.parse(response.body);
      expect(body.units.length).toBeGreaterThan(0);
      expect(body.units.every((u) => u.cre === 1)).toBe(true);
    });

    /** PRD 8.2: busca textual é o caminho quando a geocodificação falha. */
    it('busca por nome', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .get('/units/recommendations')
        .query({ applicationId: id, search: 'CRECHE', limit: 10 })
        .expect(200);

      const body = recommendationListSchema.parse(response.body);
      expect(body.units.length).toBeGreaterThan(0);
      expect(body.units.every((u) => u.name.toUpperCase().includes('CRECHE'))).toBe(true);
    });

    it('responde 404 para inscrição inexistente', async () => {
      await request(http)
        .get('/units/recommendations')
        .query({ applicationId: '11111111-1111-4111-8111-111111111111' })
        .expect(404);
    });
  });

  describe('PUT /applications/:id/preferences', () => {
    async function primeirosCodigos(id: string, quantos: number): Promise<string[]> {
      const response = await request(http)
        .get('/units/recommendations')
        .query({ applicationId: id, limit: quantos })
        .expect(200);
      return recommendationListSchema.parse(response.body).units.map((unit) => unit.code);
    }

    it('registra a ordem exata submetida (PRD 8.6)', async () => {
      const id = await criarInscricao();
      await comAncora(id);
      const codigos = await primeirosCodigos(id, 3);

      const response = await request(http)
        .put(`/applications/${id}/preferences`)
        .send({
          preferences: codigos.map((unitCode) => ({
            unitCode,
            ageGroupCode: 'MATERNAL_I',
            shift: 'INTEGRAL',
          })),
        })
        .expect(200);

      const body = preferenceListSchema.parse(response.body);
      expect(body.preferences.map((p) => p.position)).toEqual([1, 2, 3]);
      expect(body.preferences.map((p) => p.unit.code)).toEqual(codigos);
    });

    it('substitui a lista inteira, preservando a nova ordem', async () => {
      const id = await criarInscricao();
      await comAncora(id);
      const codigos = await primeirosCodigos(id, 3);
      const item = (unitCode: string) => ({
        unitCode,
        ageGroupCode: 'MATERNAL_I',
        shift: 'INTEGRAL',
      });

      await request(http)
        .put(`/applications/${id}/preferences`)
        .send({ preferences: codigos.map(item) })
        .expect(200);

      const invertido = [...codigos].reverse();
      const response = await request(http)
        .put(`/applications/${id}/preferences`)
        .send({ preferences: invertido.map(item) })
        .expect(200);

      expect(preferenceListSchema.parse(response.body).preferences.map((p) => p.unit.code)).toEqual(
        invertido,
      );
    });

    /** PRD 8.6: a mesma unidade não se repete para grupamento e turno iguais. */
    it('recusa a mesma unidade repetida no mesmo grupamento e turno', async () => {
      const id = await criarInscricao();
      const [codigo] = await primeirosCodigos(id, 1);

      const response = await request(http)
        .put(`/applications/${id}/preferences`)
        .send({
          preferences: [
            { unitCode: codigo, ageGroupCode: 'MATERNAL_I', shift: 'INTEGRAL' },
            { unitCode: codigo, ageGroupCode: 'MATERNAL_I', shift: 'INTEGRAL' },
          ],
        })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('VALIDATION_FAILED');
    });

    it('aceita a mesma unidade em turnos diferentes', async () => {
      const id = await criarInscricao();
      const [codigo] = await primeirosCodigos(id, 1);

      await request(http)
        .put(`/applications/${id}/preferences`)
        .send({
          preferences: [
            { unitCode: codigo, ageGroupCode: 'MATERNAL_I', shift: 'INTEGRAL' },
            { unitCode: codigo, ageGroupCode: 'MATERNAL_I', shift: 'PARCIAL' },
          ],
        })
        .expect(200);
    });

    it('recusa mais de cinco unidades', async () => {
      const id = await criarInscricao();
      const codigos = await primeirosCodigos(id, 6);

      await request(http)
        .put(`/applications/${id}/preferences`)
        .send({
          preferences: codigos.map((unitCode) => ({
            unitCode,
            ageGroupCode: 'MATERNAL_I',
            shift: 'INTEGRAL',
          })),
        })
        .expect(400);
    });

    it('recusa lista vazia', async () => {
      const id = await criarInscricao();
      await request(http)
        .put(`/applications/${id}/preferences`)
        .send({ preferences: [] })
        .expect(400);
    });

    it('recusa unidade inexistente', async () => {
      const id = await criarInscricao();
      const response = await request(http)
        .put(`/applications/${id}/preferences`)
        .send({
          preferences: [{ unitCode: '9999999', ageGroupCode: 'MATERNAL_I', shift: 'INTEGRAL' }],
        })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe('UNKNOWN_UNIT');
    });

    it('marca a unidade distante sem impedir a escolha (PRD 8.6)', async () => {
      const id = await criarInscricao();
      await comAncora(id);

      // A última da lista é a mais distante do ponto informado.
      const todas = await request(http)
        .get('/units/recommendations')
        .query({ applicationId: id, limit: 100 })
        .expect(200);
      const distante = recommendationListSchema.parse(todas.body).units.at(-1);

      const response = await request(http)
        .put(`/applications/${id}/preferences`)
        .send({
          preferences: [
            { unitCode: distante?.code, ageGroupCode: 'MATERNAL_I', shift: 'INTEGRAL' },
          ],
        })
        .expect(200);

      expect(preferenceListSchema.parse(response.body).preferences[0]?.isFar).toBe(true);
    });

    it('audita a substituição', async () => {
      const id = await criarInscricao();
      const [codigo] = await primeirosCodigos(id, 1);
      await request(http)
        .put(`/applications/${id}/preferences`)
        .send({
          preferences: [{ unitCode: codigo, ageGroupCode: 'MATERNAL_I', shift: 'INTEGRAL' }],
        })
        .expect(200);

      const evento = await prisma.auditEvent.findFirst({
        where: { entity: 'Preference', action: 'PREFERENCES_REPLACE' },
      });
      expect(evento).not.toBeNull();
      expect(evento?.correlationId).toBeTruthy();
    });
  });
});
