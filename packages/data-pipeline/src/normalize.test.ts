import { describe, expect, it } from 'vitest';

import {
  isWithinRio,
  normalizeCep,
  normalizeText,
  normalizeUnitCode,
  nullify,
  parseCoordinate,
} from './normalize';

describe('normalizeUnitCode', () => {
  it('ancora creches parceiras em cinco digitos', () => {
    expect(normalizeUnitCode('1004')).toBe('01004');
    expect(normalizeUnitCode('01004')).toBe('01004');
  });

  it('ancora unidades publicas em sete digitos', () => {
    expect(normalizeUnitCode('101601')).toBe('0101601');
    expect(normalizeUnitCode('0101601')).toBe('0101601');
  });

  it('preserva zeros a esquerda ja presentes', () => {
    expect(normalizeUnitCode('00001')).toBe('00001');
  });

  it('rejeita o que nao for codigo', () => {
    for (const entrada of ['', '   ', 'NULL', 'AB123', '12345678', null, undefined]) {
      expect(normalizeUnitCode(entrada)).toBeNull();
    }
  });
});

describe('nullify', () => {
  it('trata a string literal NULL como ausencia', () => {
    expect(nullify('NULL')).toBeNull();
    expect(nullify('null')).toBeNull();
    expect(nullify('  ')).toBeNull();
  });

  it('preserva conteudo real', () => {
    expect(nullify('  CAJU ')).toBe('CAJU');
  });
});

describe('normalizeText', () => {
  it('colapsa espacos internos preservando acentuacao', () => {
    expect(normalizeText(' SAO   CRISTOVAO ')).toBe('SAO CRISTOVAO');
    expect(normalizeText('EDUCANDÁRIO NOSSA  SENHORA')).toBe('EDUCANDÁRIO NOSSA SENHORA');
  });
});

describe('normalizeCep', () => {
  it('normaliza para oito digitos preservando zeros a esquerda', () => {
    expect(normalizeCep('20931004')).toBe('20931004');
    expect(normalizeCep('20931-004')).toBe('20931004');
    expect(normalizeCep('1234')).toBe('00001234');
  });

  it('descarta ausencias e valores longos demais', () => {
    expect(normalizeCep('NULL')).toBeNull();
    expect(normalizeCep('209310041')).toBeNull();
  });
});

describe('coordenadas', () => {
  it('aceita ponto e virgula decimal', () => {
    expect(parseCoordinate('-22.934191')).toBeCloseTo(-22.934191);
    expect(parseCoordinate('-22,934191')).toBeCloseTo(-22.934191);
    expect(parseCoordinate('NULL')).toBeNull();
  });

  it('reconhece o que esta fora do municipio', () => {
    expect(isWithinRio(-22.93, -43.2)).toBe(true);
    expect(isWithinRio(-30.0, -43.2)).toBe(false);
    expect(isWithinRio(null, -43.2)).toBe(false);
  });
});
