import { describe, expect, it } from 'vitest';

import { cepSector, formatCep, normalizeCep } from './cep';

describe('normalizeCep', () => {
  it('aceita as formas que a familia digita', () => {
    expect(normalizeCep('20931004')).toBe('20931004');
    expect(normalizeCep('20931-004')).toBe('20931004');
    expect(normalizeCep(' 20931 004 ')).toBe('20931004');
  });

  it('preserva zeros a esquerda', () => {
    expect(normalizeCep('1234')).toBe('00001234');
    expect(normalizeCep('01310100')).toBe('01310100');
  });

  it('devolve null sem CEP reconhecivel', () => {
    for (const entrada of ['', '   ', 'NULL', 'abc', '123456789', null, undefined]) {
      expect(normalizeCep(entrada)).toBeNull();
    }
  });
});

describe('cepSector', () => {
  it('usa os cinco primeiros digitos', () => {
    expect(cepSector('20931004')).toBe('20931');
    expect(cepSector('00001234')).toBe('00001');
  });
});

describe('formatCep', () => {
  it('formata para exibicao', () => {
    expect(formatCep('20931004')).toBe('20931-004');
  });
});
