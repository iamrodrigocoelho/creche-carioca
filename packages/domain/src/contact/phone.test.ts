import { describe, expect, it } from 'vitest';

import { formatPhone, isMobile, maskPhone, normalizeE164 } from './phone';

describe('normalizeE164', () => {
  it('aceita as formas que as pessoas digitam', () => {
    for (const entrada of [
      '(21) 98765-4321',
      '21987654321',
      '+55 21 98765-4321',
      '5521987654321',
      '+5521987654321',
    ]) {
      expect(normalizeE164(entrada)).toBe('+5521987654321');
    }
  });

  it('aceita fixo de oito digitos', () => {
    expect(normalizeE164('(21) 3333-4444')).toBe('+552133334444');
  });

  it('rejeita DDD inexistente', () => {
    // 20 e 23 nao sao DDDs atribuidos.
    expect(normalizeE164('20987654321')).toBeNull();
    expect(normalizeE164('23987654321')).toBeNull();
  });

  it('rejeita movel que nao comeca com 9', () => {
    expect(normalizeE164('21887654321')).toBeNull();
  });

  it('rejeita fixo fora da faixa 2 a 5', () => {
    expect(normalizeE164('2198765432')).toBeNull();
    expect(normalizeE164('2133334444')).toBe('+552133334444');
  });

  it('rejeita comprimento invalido e entrada vazia', () => {
    for (const entrada of ['', '   ', '119876', '2198765432199', null, undefined]) {
      expect(normalizeE164(entrada)).toBeNull();
    }
  });
});

describe('isMobile', () => {
  it('distingue movel de fixo', () => {
    expect(isMobile('+5521987654321')).toBe(true);
    expect(isMobile('+552133334444')).toBe(false);
  });
});

describe('formatPhone', () => {
  it('formata movel e fixo', () => {
    expect(formatPhone('+5521987654321')).toBe('(21) 98765-4321');
    expect(formatPhone('+552133334444')).toBe('(21) 3333-4444');
  });
});

describe('maskPhone', () => {
  /** PRD 13.4: contatos mascarados por padrao. */
  it('preserva DDD e os quatro ultimos digitos', () => {
    expect(maskPhone('+5521987654321')).toBe('(21) •••••-4321');
    expect(maskPhone('+552133334444')).toBe('(21) ••••-4444');
  });

  it('nao deixa vazar o miolo do numero', () => {
    const mascarado = maskPhone('+5521987654321');
    expect(mascarado).not.toContain('98765');
    expect(mascarado).not.toContain('8765');
  });
});
