import { describe, expect, it } from 'vitest';

import {
  applicationSchema,
  createApplicationSchema,
  processIdSchema,
  updateApplicationSchema,
} from './application';

const validCreate = {
  processId: 'DEMO-2026',
  child: { birthYear: 2024, birthMonth: 3 },
  desiredShift: 'INTEGRAL',
};

describe('createApplicationSchema', () => {
  it('aceita a carga minima da Fase 1', () => {
    expect(createApplicationSchema.parse(validCreate).processId).toBe('DEMO-2026');
  });

  it('aceita sexo e data de referencia opcionais', () => {
    const parsed = createApplicationSchema.parse({
      ...validCreate,
      child: { ...validCreate.child, sex: 'NAO_INFORMADO' },
      referenceDate: '2026-03-31',
    });

    expect(parsed.child.sex).toBe('NAO_INFORMADO');
    expect(parsed.referenceDate).toBe('2026-03-31');
  });

  it.each([0, 13])('rejeita mes %s', (birthMonth) => {
    const result = createApplicationSchema.safeParse({
      ...validCreate,
      child: { ...validCreate.child, birthMonth },
    });

    expect(result.success).toBe(false);
  });

  it('rejeita turno desconhecido', () => {
    expect(
      createApplicationSchema.safeParse({ ...validCreate, desiredShift: 'NOTURNO' }).success,
    ).toBe(false);
  });

  it('rejeita data de referencia fora do formato ISO', () => {
    expect(
      createApplicationSchema.safeParse({ ...validCreate, referenceDate: '31/03/2026' }).success,
    ).toBe(false);
  });

  it('remove campos desconhecidos em vez de propaga-los', () => {
    const parsed = createApplicationSchema.parse({ ...validCreate, admin: true });

    expect(parsed).not.toHaveProperty('admin');
  });
});

describe('processIdSchema', () => {
  it.each(["DEMO'; DROP TABLE", '../../etc/passwd', '<script>', 'a'.repeat(33), ''])(
    'rejeita %s',
    (value) => {
      expect(processIdSchema.safeParse(value).success).toBe(false);
    },
  );

  it('remove espacos nas bordas', () => {
    expect(processIdSchema.parse('  DEMO-2026  ')).toBe('DEMO-2026');
  });
});

describe('updateApplicationSchema', () => {
  it('aceita atualizacao parcial da crianca', () => {
    expect(updateApplicationSchema.parse({ child: { birthMonth: 5 } }).child?.birthMonth).toBe(5);
  });

  it('aceita apenas a data de referencia', () => {
    expect(updateApplicationSchema.parse({ referenceDate: '2027-03-31' }).referenceDate).toBe(
      '2027-03-31',
    );
  });

  it('rejeita corpo vazio', () => {
    expect(updateApplicationSchema.safeParse({}).success).toBe(false);
  });
});

describe('applicationSchema', () => {
  it('exige identificadores nao sequenciais (PRD 13.5)', () => {
    const result = applicationSchema.safeParse({
      id: '1',
      anonymousChildId: '2',
      status: 'RASCUNHO',
      processId: 'DEMO-2026',
      child: { birthYear: 2024, birthMonth: 3 },
      desiredShift: 'INTEGRAL',
      ageGroup: {
        outcome: 'MATCHED',
        code: 'MATERNAL_I',
        label: 'Maternal I',
        ageInMonths: 24,
        referenceDate: '2026-03-31',
        policy: { id: 'p', version: 1, status: 'DEMONSTRACAO', processId: 'DEMO-2026' },
        explanation: [],
      },
      createdAt: '2026-08-30T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    });

    expect(result.success).toBe(false);
  });
});
