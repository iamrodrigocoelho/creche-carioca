import { describe, expect, it } from 'vitest';

import { flagDuplicateCeps, resolveAnchorPosition } from './location-anchor';

describe('resolveAnchorPosition', () => {
  it('coloca a residencia na primeira posicao quando nao ha nenhuma', () => {
    expect(resolveAnchorPosition({ requested: undefined, kind: 'RESIDENCIA', taken: [] })).toEqual({
      ok: true,
      position: 1,
    });
  });

  it('usa a primeira posicao livre para os opcionais', () => {
    expect(resolveAnchorPosition({ requested: undefined, kind: 'TRABALHO', taken: [1] })).toEqual({
      ok: true,
      position: 2,
    });
    expect(
      resolveAnchorPosition({ requested: undefined, kind: 'REDE_APOIO', taken: [1, 2] }),
    ).toEqual({ ok: true, position: 3 });
  });

  it('reaproveita a lacuna deixada por um ponto removido', () => {
    expect(resolveAnchorPosition({ requested: undefined, kind: 'OUTRO', taken: [1, 3] })).toEqual({
      ok: true,
      position: 2,
    });
  });

  it('recusa o quarto ponto', () => {
    expect(
      resolveAnchorPosition({ requested: undefined, kind: 'OUTRO', taken: [1, 2, 3] }),
    ).toEqual({ ok: false, violation: 'ANCHOR_LIMIT_REACHED' });
  });

  it('exige que a primeira posicao seja a residencia', () => {
    expect(resolveAnchorPosition({ requested: 1, kind: 'TRABALHO', taken: [] })).toEqual({
      ok: false,
      violation: 'ANCHOR_POSITION_MISMATCH',
    });
    expect(resolveAnchorPosition({ requested: undefined, kind: 'TRABALHO', taken: [] })).toEqual({
      ok: false,
      violation: 'ANCHOR_POSITION_MISMATCH',
    });
  });

  it('impede residencia fora da primeira posicao', () => {
    expect(resolveAnchorPosition({ requested: 2, kind: 'RESIDENCIA', taken: [1] })).toEqual({
      ok: false,
      violation: 'ANCHOR_POSITION_MISMATCH',
    });
  });

  it('permite corrigir a residencia no lugar', () => {
    expect(resolveAnchorPosition({ requested: 1, kind: 'RESIDENCIA', taken: [1] })).toEqual({
      ok: true,
      position: 1,
    });
  });
});

describe('flagDuplicateCeps', () => {
  it('aponta para a primeira ocorrencia, sem recusar', () => {
    const marcados = flagDuplicateCeps([
      { position: 1, cep: '20060000' },
      { position: 2, cep: '20060000' },
      { position: 3, cep: '20071000' },
    ]);

    expect(marcados.map((a) => a.duplicateOfPosition)).toEqual([null, 1, null]);
  });

  it('nao marca nada quando os CEPs diferem', () => {
    const marcados = flagDuplicateCeps([
      { position: 1, cep: '20060000' },
      { position: 2, cep: '20071000' },
    ]);
    expect(marcados.every((a) => a.duplicateOfPosition === null)).toBe(true);
  });
});
