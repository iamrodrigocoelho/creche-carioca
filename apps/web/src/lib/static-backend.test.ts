import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CreateApplicationInput } from '@match/schemas';

import {
  clearLocalData,
  createApplicationLocally,
  listAnchorsLocally,
  removeAnchorLocally,
  upsertAnchorLocally,
} from './static-backend';

/**
 * O backend do navegador precisa se comportar como a API (ADR-0027). Os casos
 * aqui espelham os testes de integracao de `apps/api`, com os mesmos codigos de
 * erro — se um lado mudar sozinho, a mesma familia veria respostas diferentes
 * conforme a versao que abrisse.
 */

const INSCRICAO: CreateApplicationInput = {
  processId: 'DEMO-2026',
  child: { birthYear: 2024, birthMonth: 3 },
  desiredShift: 'INTEGRAL',
};

const CEP_RESOLVIVEL = '20060-000';
const CEP_SEM_SETOR = '99999000';

function novaInscricao(): string {
  const criada = createApplicationLocally(INSCRICAO);
  if (!criada.ok) throw new Error('esperava criar a inscrição');
  return criada.data.id;
}

beforeEach(() => {
  clearLocalData();
});

afterEach(() => {
  clearLocalData();
});

describe('createApplicationLocally', () => {
  it('calcula o grupamento com a política de demonstração', () => {
    const criada = createApplicationLocally(INSCRICAO);
    if (!criada.ok) throw new Error('esperava sucesso');

    expect(criada.data.ageGroup.code).toBe('MATERNAL_I');
    expect(criada.data.ageGroup.label).toBe('Maternal I');
    // PRD 1.2: nunca passar dado sintetico por oficial.
    expect(criada.data.ageGroup.policy.status).toBe('DEMONSTRACAO');
    expect(criada.data.ageGroup.explanation.length).toBeGreaterThan(0);
  });

  it('recusa processo desconhecido com o mesmo codigo da API', () => {
    const criada = createApplicationLocally({ ...INSCRICAO, processId: 'INEXISTENTE' });
    expect(criada).toMatchObject({ ok: false, error: { code: 'UNKNOWN_PROCESS' } });
  });

  it('sobrevive a recarregar: a inscricao continua encontrável', () => {
    const id = novaInscricao();
    expect(listAnchorsLocally(id).ok).toBe(true);
  });
});

describe('pontos de referência', () => {
  it('geocodifica com a mesma referência da API e declara a incerteza', () => {
    const id = novaInscricao();
    const salvo = upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'RESIDENCIA' });
    if (!salvo.ok) throw new Error('esperava sucesso');

    const [anchor] = salvo.data.anchors;
    expect(anchor?.cep).toBe('20060000');
    expect(anchor?.status).toBe('RESOLVIDO');
    expect(anchor?.precisionKm).toBeGreaterThan(0);
    expect(salvo.data.hasResidence).toBe(true);
  });

  it('grava o ponto mesmo quando o CEP não resolve', () => {
    const id = novaInscricao();
    const salvo = upsertAnchorLocally(id, { cep: CEP_SEM_SETOR, kind: 'RESIDENCIA' });
    if (!salvo.ok) throw new Error('esperava sucesso');

    expect(salvo.data.anchors[0]?.status).toBe('FALHOU');
    expect(salvo.data.anchors[0]?.latitude).toBeNull();
    expect(salvo.data.hasResidence).toBe(true);
  });

  it('exige que o primeiro ponto seja a residência', () => {
    const id = novaInscricao();
    expect(upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'TRABALHO' })).toMatchObject({
      ok: false,
      error: { code: 'ANCHOR_POSITION_MISMATCH' },
    });
  });

  it('sinaliza CEP repetido sem recusar', () => {
    const id = novaInscricao();
    upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'RESIDENCIA' });
    const salvo = upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'TRABALHO' });
    if (!salvo.ok) throw new Error('esperava sucesso');

    expect(salvo.data.anchors.map((a) => a.duplicateOfPosition)).toEqual([null, 1]);
  });

  it('recusa o quarto ponto', () => {
    const id = novaInscricao();
    upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'RESIDENCIA' });
    upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'TRABALHO' });
    upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'REDE_APOIO' });

    expect(upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'OUTRO' })).toMatchObject({
      ok: false,
      error: { code: 'ANCHOR_LIMIT_REACHED' },
    });
  });

  it('corrige a residência no lugar, sem exigir remoção', () => {
    const id = novaInscricao();
    upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'RESIDENCIA' });
    const salvo = upsertAnchorLocally(id, {
      cep: CEP_SEM_SETOR,
      kind: 'RESIDENCIA',
      position: 1,
    });
    if (!salvo.ok) throw new Error('esperava sucesso');

    expect(salvo.data.anchors).toHaveLength(1);
    expect(salvo.data.anchors[0]?.cep).toBe(CEP_SEM_SETOR);
  });

  it('recusa remover a residência', () => {
    const id = novaInscricao();
    upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'RESIDENCIA' });

    expect(removeAnchorLocally(id, 1)).toMatchObject({
      ok: false,
      error: { code: 'RESIDENCE_ANCHOR_REQUIRED' },
    });
  });

  it('remove um ponto opcional', () => {
    const id = novaInscricao();
    upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'RESIDENCIA' });
    upsertAnchorLocally(id, { cep: CEP_RESOLVIVEL, kind: 'TRABALHO' });

    const removido = removeAnchorLocally(id, 2);
    if (!removido.ok) throw new Error('esperava sucesso');
    expect(removido.data.anchors).toHaveLength(1);
  });

  it('recusa CEP inválido com o mesmo código da API', () => {
    const id = novaInscricao();
    expect(upsertAnchorLocally(id, { cep: 'abc', kind: 'RESIDENCIA' })).toMatchObject({
      ok: false,
      error: { code: 'VALIDATION_FAILED' },
    });
  });

  it('responde inscrição não encontrada para id desconhecido', () => {
    expect(listAnchorsLocally('nao-existe')).toMatchObject({
      ok: false,
      error: { code: 'APPLICATION_NOT_FOUND' },
    });
  });
});

describe('clearLocalData', () => {
  it('apaga tudo que ficou no dispositivo', () => {
    const id = novaInscricao();
    clearLocalData();
    expect(listAnchorsLocally(id).ok).toBe(false);
  });
});
