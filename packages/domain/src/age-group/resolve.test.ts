import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors';
import { DEMO_AGE_GROUP_POLICY_2026, findAgeGroupPolicy, listAgeGroupPolicies } from './policy';
import type { AgeGroupPolicy } from './policy';
import { ageInMonthsAt, parseIsoDate, resolveAgeGroup } from './resolve';

const policy = DEMO_AGE_GROUP_POLICY_2026;

describe('parseIsoDate', () => {
  it('interpreta uma data valida sem deslocamento de fuso', () => {
    expect(parseIsoDate('2026-03-31')).toEqual({ year: 2026, month: 3, day: 31 });
  });

  it('rejeita formato invalido', () => {
    expect(() => parseIsoDate('31/03/2026')).toThrowError(DomainError);
  });

  it('rejeita data inexistente no calendario', () => {
    expect(() => parseIsoDate('2026-02-31')).toThrowError(/inexistente/i);
  });

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(parseIsoDate('2024-02-29').day).toBe(29);
  });
});

describe('ageInMonthsAt', () => {
  it('conta meses completos atravessando a virada do ano', () => {
    expect(ageInMonthsAt(2025, 11, { year: 2026, month: 3, day: 31 })).toBe(4);
  });

  it('retorna zero quando nascimento e referencia estao no mesmo mes', () => {
    expect(ageInMonthsAt(2026, 3, { year: 2026, month: 3, day: 1 })).toBe(0);
  });

  it('nao depende do dia da data de referencia', () => {
    const first = ageInMonthsAt(2024, 5, { year: 2026, month: 3, day: 1 });
    const last = ageInMonthsAt(2024, 5, { year: 2026, month: 3, day: 31 });
    expect(first).toBe(last);
  });
});

describe('resolveAgeGroup - faixas da politica de demonstracao', () => {
  const cases = [
    { birthYear: 2025, birthMonth: 9, expected: 'BERCARIO_I', months: 6 },
    { birthYear: 2025, birthMonth: 4, expected: 'BERCARIO_I', months: 11 },
    { birthYear: 2025, birthMonth: 3, expected: 'BERCARIO_II', months: 12 },
    { birthYear: 2024, birthMonth: 4, expected: 'BERCARIO_II', months: 23 },
    { birthYear: 2024, birthMonth: 3, expected: 'MATERNAL_I', months: 24 },
    { birthYear: 2023, birthMonth: 4, expected: 'MATERNAL_I', months: 35 },
    { birthYear: 2023, birthMonth: 3, expected: 'MATERNAL_II', months: 36 },
    { birthYear: 2022, birthMonth: 4, expected: 'MATERNAL_II', months: 47 },
  ] as const;

  it.each(cases)(
    'nascimento $birthMonth/$birthYear cai em $expected',
    ({ birthYear, birthMonth, expected, months }) => {
      const result = resolveAgeGroup({ birthYear, birthMonth, policy });

      expect(result.outcome).toBe('MATCHED');
      expect(result.band?.code).toBe(expected);
      expect(result.ageInMonths).toBe(months);
    },
  );

  it('sinaliza idade abaixo do minimo sem lancar erro', () => {
    const result = resolveAgeGroup({ birthYear: 2026, birthMonth: 1, policy });

    expect(result.outcome).toBe('BELOW_MINIMUM_AGE');
    expect(result.band).toBeNull();
    expect(result.explanation.at(-1)?.code).toBe('BELOW_MINIMUM_AGE');
  });

  it('sinaliza idade acima do maximo sem lancar erro', () => {
    const result = resolveAgeGroup({ birthYear: 2022, birthMonth: 3, policy });

    expect(result.outcome).toBe('ABOVE_MAXIMUM_AGE');
    expect(result.band).toBeNull();
    expect(result.explanation.at(-1)?.code).toBe('ABOVE_MAXIMUM_AGE');
  });
});

describe('resolveAgeGroup - recalculo (PRD 8.1)', () => {
  it('muda de grupamento quando o nascimento muda', () => {
    const before = resolveAgeGroup({ birthYear: 2024, birthMonth: 4, policy });
    const after = resolveAgeGroup({ birthYear: 2024, birthMonth: 3, policy });

    expect(before.band?.code).toBe('BERCARIO_II');
    expect(after.band?.code).toBe('MATERNAL_I');
  });

  it('muda de grupamento quando a data de referencia muda', () => {
    const input = { birthYear: 2024, birthMonth: 4, policy } as const;

    const atPolicyDate = resolveAgeGroup(input);
    const oneYearLater = resolveAgeGroup({ ...input, referenceDate: '2027-03-31' });

    expect(atPolicyDate.band?.code).toBe('BERCARIO_II');
    expect(oneYearLater.band?.code).toBe('MATERNAL_I');
    expect(oneYearLater.referenceDate).toBe('2027-03-31');
  });

  it('e deterministico para a mesma entrada e versao de regra', () => {
    const input = { birthYear: 2024, birthMonth: 7, policy } as const;

    expect(resolveAgeGroup(input)).toEqual(resolveAgeGroup(input));
  });
});

describe('resolveAgeGroup - explicacao estruturada (PRD 8.7)', () => {
  it('descreve entrada, referencia, idade e faixa aplicada', () => {
    const result = resolveAgeGroup({ birthYear: 2024, birthMonth: 3, policy });

    expect(result.explanation.map((step) => step.code)).toEqual([
      'BIRTH_INPUT',
      'REFERENCE_DATE',
      'AGE_IN_MONTHS',
      'BAND_MATCHED',
    ]);
    expect(result.explanation[0]?.values).toEqual({ birthYear: 2024, birthMonth: 3 });
    expect(result.explanation[3]?.values.band).toBe('MATERNAL_I');
  });

  it('formata idades em anos e meses de forma legivel', () => {
    const oneYearOnly = resolveAgeGroup({ birthYear: 2025, birthMonth: 3, policy });
    const yearsAndMonths = resolveAgeGroup({ birthYear: 2024, birthMonth: 8, policy });
    const monthsOnly = resolveAgeGroup({ birthYear: 2025, birthMonth: 9, policy });

    expect(oneYearOnly.explanation[2]?.summary).toContain('1 ano');
    expect(yearsAndMonths.explanation[2]?.summary).toContain('1 ano e 7 meses');
    expect(monthsOnly.explanation[2]?.summary).toContain('6 meses');
  });

  it('rende "0 mês" quando a idade e zero', () => {
    const result = resolveAgeGroup({ birthYear: 2026, birthMonth: 3, policy });

    expect(result.explanation[2]?.summary).toContain('0 mês');
  });

  it('propaga a versao e o status da regra aplicada', () => {
    const result = resolveAgeGroup({ birthYear: 2024, birthMonth: 3, policy });

    expect(result.policy).toEqual({
      id: policy.id,
      version: policy.version,
      status: 'DEMONSTRACAO',
      processId: policy.processId,
    });
  });
});

describe('resolveAgeGroup - validacao de entrada', () => {
  it.each([0, 13, 3.5, -1])('rejeita mes de nascimento %s', (birthMonth) => {
    expect(() => resolveAgeGroup({ birthYear: 2025, birthMonth, policy })).toThrowError(
      expect.objectContaining({ code: 'INVALID_BIRTH_MONTH' }),
    );
  });

  it('rejeita ano de nascimento nao inteiro', () => {
    expect(() => resolveAgeGroup({ birthYear: 2025.5, birthMonth: 3, policy })).toThrowError(
      expect.objectContaining({ code: 'INVALID_BIRTH_YEAR' }),
    );
  });

  it('rejeita ano anterior ao minimo aceito', () => {
    expect(() => resolveAgeGroup({ birthYear: 1899, birthMonth: 3, policy })).toThrowError(
      expect.objectContaining({ code: 'INVALID_BIRTH_YEAR' }),
    );
  });

  it('rejeita ano muito posterior a data de referencia', () => {
    expect(() => resolveAgeGroup({ birthYear: 2028, birthMonth: 3, policy })).toThrowError(
      expect.objectContaining({ code: 'INVALID_BIRTH_YEAR' }),
    );
  });

  it('nao inclui a mensagem de erro em texto livre do usuario', () => {
    try {
      resolveAgeGroup({ birthYear: 2025, birthMonth: 99, policy });
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).details).toEqual({ received: 99 });
    }
  });
});

describe('resolveAgeGroup - validacao da politica', () => {
  const base: AgeGroupPolicy = { ...policy, bands: [] };

  it('rejeita politica sem faixas', () => {
    expect(() => resolveAgeGroup({ birthYear: 2024, birthMonth: 3, policy: base })).toThrowError(
      expect.objectContaining({ code: 'INVALID_POLICY' }),
    );
  });

  it('rejeita faixa com limites invertidos', () => {
    const invalid: AgeGroupPolicy = {
      ...policy,
      bands: [{ code: 'BERCARIO_I', label: 'Bercario I', minAgeMonths: 20, maxAgeMonths: 5 }],
    };

    expect(() => resolveAgeGroup({ birthYear: 2024, birthMonth: 3, policy: invalid })).toThrowError(
      /invertidos/i,
    );
  });

  it('rejeita faixas sobrepostas', () => {
    const invalid: AgeGroupPolicy = {
      ...policy,
      bands: [
        { code: 'BERCARIO_I', label: 'Bercario I', minAgeMonths: 6, maxAgeMonths: 12 },
        { code: 'BERCARIO_II', label: 'Bercario II', minAgeMonths: 12, maxAgeMonths: 23 },
      ],
    };

    expect(() => resolveAgeGroup({ birthYear: 2024, birthMonth: 3, policy: invalid })).toThrowError(
      /sobrepostas/i,
    );
  });

  it('rejeita data de referencia invalida vinda da chamada', () => {
    expect(() =>
      resolveAgeGroup({ birthYear: 2024, birthMonth: 3, policy, referenceDate: 'ontem' }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_REFERENCE_DATE' }));
  });
});

describe('catalogo de politicas', () => {
  it('encontra a politica pelo processo', () => {
    expect(findAgeGroupPolicy('DEMO-2026')?.id).toBe(policy.id);
  });

  it('retorna undefined para processo desconhecido', () => {
    expect(findAgeGroupPolicy('PROCESSO-INEXISTENTE')).toBeUndefined();
  });

  it('lista as politicas conhecidas', () => {
    expect(listAgeGroupPolicies()).toHaveLength(1);
  });

  it('mantem a politica embarcada marcada como demonstracao (PRD 1.2)', () => {
    expect(listAgeGroupPolicies().every((item) => item.status === 'DEMONSTRACAO')).toBe(true);
  });
});
