import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@match/database';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DEMO_AGE_GROUP_POLICY_2026 } from '@match/domain';

import { AppModule } from '../app.module';
import { configureApp } from '../bootstrap';
import { loadEnv } from '../common/config/env';
import {
  ensureSeed,
  resetEverything,
  resetTransactionalData,
  testPrismaClient,
} from '../../test/database';

/**
 * Testes de persistencia da Fase 2 (PRD 14.3).
 *
 * Cobrem o que a Fase 1 nao podia garantir com repositorio em memoria:
 * durabilidade, transacionalidade, trilha de auditoria e append-only.
 */

const validBody = {
  processId: 'DEMO-2026',
  child: { birthYear: 2024, birthMonth: 3 },
  desiredShift: 'INTEGRAL',
};

describe('Persistencia PostgreSQL', () => {
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

  describe('Escrita transacional', () => {
    it('grava crianca, inscricao, evento de status e auditoria juntos', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);

      const application = await prisma.application.findUnique({
        where: { id: created.body.id },
        include: { child: true, statusEvents: true, process: true },
      });

      expect(application).not.toBeNull();
      expect(application?.child.birthYear).toBe(2024);
      expect(application?.process.code).toBe('DEMO-2026');
      expect(application?.statusEvents).toHaveLength(1);
      expect(application?.statusEvents[0]).toMatchObject({
        fromStatus: null,
        toStatus: 'RASCUNHO',
      });

      const audit = await prisma.auditEvent.findMany({ where: { entityId: created.body.id } });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        action: 'application.created',
        entity: 'Application',
        origin: 'API',
      });
    });

    it('nao deixa crianca orfa quando o processo nao existe', async () => {
      const before = await prisma.child.count();

      await request(http)
        .post('/applications')
        .send({ ...validBody, processId: 'INEXISTENTE' })
        .expect(400);

      expect(await prisma.child.count()).toBe(before);
    });

    it('a inscricao sobrevive a um novo cliente Prisma (durabilidade)', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);

      const other = testPrismaClient();
      try {
        const found = await other.application.findUnique({ where: { id: created.body.id } });
        expect(found).not.toBeNull();
      } finally {
        await other.$disconnect();
      }
    });

    it('expoe a referencia anonima da crianca, nunca a chave primaria interna', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);

      const application = await prisma.application.findUnique({
        where: { id: created.body.id },
        include: { child: true },
      });

      expect(created.body.anonymousChildId).toBe(application?.child.anonymousRef);
      expect(created.body.anonymousChildId).not.toBe(application?.child.id);
    });
  });

  describe('Auditoria (RF-16 / PRD 8.16)', () => {
    it('registra ator, papel, correlation ID e origem', async () => {
      const correlationId = 'auditoria-teste-1234';

      const created = await request(http)
        .post('/applications')
        .set('X-Correlation-Id', correlationId)
        .send(validBody)
        .expect(201);

      const audit = await prisma.auditEvent.findFirst({ where: { entityId: created.body.id } });

      expect(audit).toMatchObject({
        actor: 'anonimo',
        actorRole: 'PUBLICO',
        correlationId,
      });
      expect(audit?.occurredAt).toBeInstanceOf(Date);
    });

    it('audita a atualizacao sem gravar o valor dos campos pessoais', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);

      await request(http)
        .patch(`/applications/${created.body.id}`)
        .send({ child: { birthYear: 2023, birthMonth: 3 } })
        .expect(200);

      const audit = await prisma.auditEvent.findFirst({
        where: { entityId: created.body.id, action: 'application.updated' },
      });

      expect(audit?.metadata).toEqual({ changedFields: ['birthMonth', 'birthYear'] });
      // O ano de nascimento e dado pessoal e nao pode aparecer na trilha.
      expect(JSON.stringify(audit?.metadata)).not.toContain('2023');
    });

    it('nao grava dado sensivel no metadata, mesmo se informado', async () => {
      const { AuditService } = await import('./audit.service');
      const audit = app.get(AuditService);

      await audit.record({
        actor: 'teste',
        actorRole: 'TESTE',
        action: 'teste.redacao',
        entity: 'Teste',
        entityId: '00000000-0000-4000-8000-000000000000',
        correlationId: 'teste-redacao-1234',
        metadata: { phone: '+5521999999999', cep: '20000-000', unitName: 'Creche Exemplo' },
      });

      const row = await prisma.auditEvent.findFirst({ where: { action: 'teste.redacao' } });
      const serialized = JSON.stringify(row?.metadata);

      expect(serialized).not.toContain('5521999999999');
      expect(serialized).not.toContain('20000-000');
      expect(serialized).toContain('Creche Exemplo');
    });
  });

  describe('Append-only (PRD 13.8)', () => {
    it('bloqueia UPDATE em AuditEvent', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);
      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: { entityId: created.body.id },
      });

      await expect(
        prisma.auditEvent.update({ where: { id: audit.id }, data: { action: 'adulterado' } }),
      ).rejects.toThrow(/append-only/i);
    });

    it('bloqueia DELETE em AuditEvent', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);
      const audit = await prisma.auditEvent.findFirstOrThrow({
        where: { entityId: created.body.id },
      });

      await expect(prisma.auditEvent.delete({ where: { id: audit.id } })).rejects.toThrow(
        /append-only/i,
      );
    });

    it('bloqueia UPDATE em StatusEvent', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);
      const event = await prisma.statusEvent.findFirstOrThrow({
        where: { applicationId: created.body.id },
      });

      await expect(
        prisma.statusEvent.update({ where: { id: event.id }, data: { toStatus: 'CANCELADA' } }),
      ).rejects.toThrow(/append-only/i);
    });
  });

  describe('Restricoes do banco (PRD 11.1)', () => {
    it('impede duas inscricoes da mesma crianca no mesmo processo', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);
      const application = await prisma.application.findUniqueOrThrow({
        where: { id: created.body.id },
      });

      await expect(
        prisma.application.create({
          data: {
            processId: application.processId,
            childId: application.childId,
            desiredShift: 'PARCIAL',
          },
        }),
      ).rejects.toThrow();
    });

    it('rejeita mes de nascimento fora do intervalo mesmo por escrita direta', async () => {
      await expect(
        prisma.child.create({
          data: { anonymousRef: crypto.randomUUID(), birthYear: 2024, birthMonth: 13 },
        }),
      ).rejects.toThrow();
    });

    it('rejeita data de referencia fora do formato ISO', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);

      await expect(
        prisma.application.update({
          where: { id: created.body.id },
          data: { referenceDateOverride: '31/03/2026' },
        }),
      ).rejects.toThrow();
    });

    it('impede apagar um processo que possui inscricoes', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);
      const application = await prisma.application.findUniqueOrThrow({
        where: { id: created.body.id },
      });

      await expect(
        prisma.process.delete({ where: { id: application.processId } }),
      ).rejects.toThrow();
    });
  });

  describe('Regra versionada (PRD 8.7)', () => {
    it('usa a versao de regra vinda do banco, e nao uma constante de codigo', async () => {
      const created = await request(http).post('/applications').send(validBody).expect(201);

      const rule = await prisma.ruleVersion.findFirstOrThrow({ where: { kind: 'AGE_GROUP' } });

      expect(created.body.ageGroup.policy.id).toBe(rule.id);
      expect(created.body.ageGroup.policy.version).toBe(rule.version);
      expect(created.body.ageGroup.policy.status).toBe('DEMONSTRACAO');
    });

    it('recusa a inscricao quando o processo nao tem regra publicada', async () => {
      const orphan = await prisma.process.create({
        data: {
          code: 'SEM-REGRA',
          name: 'Processo sem regra publicada',
          referenceDate: '2026-03-31',
          status: 'DEMONSTRACAO',
        },
      });

      try {
        const response = await request(http)
          .post('/applications')
          .send({ ...validBody, processId: 'SEM-REGRA' })
          .expect(400);

        expect(response.body.error.code).toBe('UNKNOWN_PROCESS');
      } finally {
        await prisma.process.delete({ where: { id: orphan.id } });
      }
    });

    it('rejeita payload de regra malformado em vez de calcular errado', async () => {
      const rule = await prisma.ruleVersion.findFirstOrThrow({ where: { kind: 'AGE_GROUP' } });
      const original = rule.payload;

      await prisma.ruleVersion.update({
        where: { id: rule.id },
        data: { payload: { bands: [{ code: 'INEXISTENTE', label: 'x' }] } },
      });

      try {
        await request(http).post('/applications').send(validBody).expect(500);
      } finally {
        await prisma.ruleVersion.update({
          where: { id: rule.id },
          data: { payload: original as object },
        });
      }
    });
  });

  describe('Seed (PRD 19, Fase 1 do roadmap)', () => {
    it('e idempotente: reexecutar nao duplica nem altera a regra publicada', async () => {
      const before = await prisma.ruleVersion.findFirstOrThrow({ where: { kind: 'AGE_GROUP' } });

      await ensureSeed(prisma);
      await ensureSeed(prisma);

      const rules = await prisma.ruleVersion.findMany({ where: { kind: 'AGE_GROUP' } });
      expect(rules).toHaveLength(1);
      expect(rules[0]?.id).toBe(before.id);
      expect(rules[0]?.createdAt.toISOString()).toBe(before.createdAt.toISOString());
    });

    it('recria processo e regra a partir do zero', async () => {
      await resetEverything(prisma);
      expect(await prisma.process.count()).toBe(0);

      await ensureSeed(prisma);

      const process_ = await prisma.process.findUniqueOrThrow({ where: { code: 'DEMO-2026' } });
      const rule = await prisma.ruleVersion.findFirstOrThrow({ where: { kind: 'AGE_GROUP' } });

      expect(process_.status).toBe('DEMONSTRACAO');
      expect(rule.version).toBe(DEMO_AGE_GROUP_POLICY_2026.version);
      expect((rule.payload as { bands: unknown[] }).bands).toHaveLength(
        DEMO_AGE_GROUP_POLICY_2026.bands.length,
      );
    });
  });
});
