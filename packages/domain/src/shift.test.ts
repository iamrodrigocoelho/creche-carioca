import { describe, expect, it } from 'vitest';

import { isDomainError, DomainError } from './errors';
import { SHIFTS, isShift, shiftLabel } from './shift';

describe('shift', () => {
  it('reconhece os turnos suportados', () => {
    expect(SHIFTS.every(isShift)).toBe(true);
  });

  it.each(['integral', 'NOTURNO', '', null, 42, undefined])('rejeita %s', (value) => {
    expect(isShift(value)).toBe(false);
  });

  it('rotula os turnos em linguagem simples (PRD 17)', () => {
    expect(shiftLabel('INTEGRAL')).toBe('Integral');
    expect(shiftLabel('PARCIAL')).toBe('Parcial');
    expect(shiftLabel('AMBOS')).toBe('Integral ou parcial');
  });
});

describe('DomainError', () => {
  it('carrega codigo estavel e detalhes nao sensiveis', () => {
    const error = new DomainError('INVALID_BIRTH_MONTH', 'mensagem', { received: 13 });

    expect(error.name).toBe('DomainError');
    expect(error.code).toBe('INVALID_BIRTH_MONTH');
    expect(error.details).toEqual({ received: 13 });
  });

  it('usa detalhes vazios por padrao', () => {
    expect(new DomainError('INVALID_POLICY', 'mensagem').details).toEqual({});
  });

  it('identifica erros de dominio', () => {
    expect(isDomainError(new DomainError('INVALID_POLICY', 'x'))).toBe(true);
    expect(isDomainError(new Error('x'))).toBe(false);
    expect(isDomainError(null)).toBe(false);
  });
});
