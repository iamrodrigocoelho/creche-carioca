import { describe, expect, it } from 'vitest';

import {
  DRAFT_STORAGE_KEY,
  EMPTY_DRAFT,
  clearDraft,
  fieldIdForPath,
  readDraft,
  validateDraft,
  writeDraft,
  type ApplicationDraft,
} from './form';

const validDraft: ApplicationDraft = {
  birthMonth: '3',
  birthYear: '2024',
  desiredShift: 'INTEGRAL',
  sex: '',
};

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe('validateDraft', () => {
  it('converte o rascunho valido no contrato da API', () => {
    const result = validateDraft(validDraft);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      processId: 'DEMO-2026',
      child: { birthYear: 2024, birthMonth: 3 },
      desiredShift: 'INTEGRAL',
    });
  });

  it('inclui o sexo apenas quando informado', () => {
    const semSexo = validateDraft(validDraft);
    const comSexo = validateDraft({ ...validDraft, sex: 'FEMININO' });

    expect(semSexo.ok && semSexo.value.child.sex).toBeUndefined();
    expect(comSexo.ok && comSexo.value.child.sex).toBe('FEMININO');
  });

  it('acusa campos vazios com mensagem por campo', () => {
    const result = validateDraft(EMPTY_DRAFT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.byField).sort()).toEqual(['birthMonth', 'birthYear', 'desiredShift']);
  });

  it('mapeia o caminho do schema para o id do campo, para ancorar o resumo de erros', () => {
    const result = validateDraft({ ...validDraft, birthMonth: '' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.path)).toContain('birthMonth');
  });

  it('mantem apenas a primeira mensagem por campo', () => {
    const result = validateDraft({ ...validDraft, birthYear: '' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.filter((issue) => issue.path === 'birthYear')).toHaveLength(1);
  });

  it('recusa turno fora do dominio', () => {
    expect(validateDraft({ ...validDraft, desiredShift: 'NOTURNO' }).ok).toBe(false);
  });

  it('devolve o proprio caminho quando ele nao esta mapeado', () => {
    expect(fieldIdForPath('processId')).toBe('processId');
  });
});

describe('rascunho local (PRD 8.1 / 17)', () => {
  it('grava e le o rascunho', () => {
    const storage = memoryStorage();
    writeDraft(storage, validDraft);

    expect(readDraft(storage)).toEqual(validDraft);
  });

  it('devolve rascunho vazio quando nao ha nada gravado', () => {
    expect(readDraft(memoryStorage())).toEqual(EMPTY_DRAFT);
  });

  it('devolve rascunho vazio quando o armazenamento nao existe', () => {
    expect(readDraft(undefined)).toEqual(EMPTY_DRAFT);
    expect(() => writeDraft(undefined, validDraft)).not.toThrow();
    expect(() => clearDraft(undefined)).not.toThrow();
  });

  it('ignora conteudo corrompido em vez de quebrar o formulario', () => {
    const storage = memoryStorage();
    storage.setItem(DRAFT_STORAGE_KEY, '{nao e json');

    expect(readDraft(storage)).toEqual(EMPTY_DRAFT);
  });

  it('ignora campos de tipo inesperado e trunca valores longos', () => {
    const storage = memoryStorage();
    storage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ birthMonth: 3, birthYear: 'x'.repeat(500), desiredShift: 'INTEGRAL' }),
    );

    const draft = readDraft(storage);
    expect(draft.birthMonth).toBe('');
    expect(draft.birthYear).toHaveLength(16);
    expect(draft.desiredShift).toBe('INTEGRAL');
  });

  it('ignora JSON que nao seja objeto', () => {
    const storage = memoryStorage();
    storage.setItem(DRAFT_STORAGE_KEY, '"texto"');

    expect(readDraft(storage)).toEqual(EMPTY_DRAFT);
  });

  it('limpa o rascunho apos o envio', () => {
    const storage = memoryStorage();
    writeDraft(storage, validDraft);
    clearDraft(storage);

    expect(readDraft(storage)).toEqual(EMPTY_DRAFT);
  });
});
