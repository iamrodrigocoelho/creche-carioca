import { describe, expect, it } from 'vitest';

import {
  canRemoveContact,
  flagDuplicateContacts,
  formatHandle,
  hasReachableContact,
  isThirdParty,
  maskHandle,
  normalizeHandle,
  phonesAmong,
  reconcilePrimary,
  type ContactSummary,
} from './rules';

function phone(id: string, extras: Partial<ContactSummary> = {}): ContactSummary {
  return { id, channel: 'TELEFONE', isPrimary: false, fingerprint: `fp-${id}`, ...extras };
}

function social(id: string, extras: Partial<ContactSummary> = {}): ContactSummary {
  return { id, channel: 'SOCIAL', isPrimary: false, fingerprint: `fp-${id}`, ...extras };
}

describe('canRemoveContact', () => {
  /** PRD 8.3: nao remover o unico telefone. */
  it('recusa remover o unico telefone', () => {
    expect(canRemoveContact([phone('a')], 'a')).toEqual({
      ok: false,
      violation: 'LAST_PHONE_CANNOT_BE_REMOVED',
    });
  });

  it('recusa mesmo quando ha perfis sociais', () => {
    expect(canRemoveContact([phone('a'), social('b')], 'a')).toEqual({
      ok: false,
      violation: 'LAST_PHONE_CANNOT_BE_REMOVED',
    });
  });

  it('permite remover quando ha outro telefone', () => {
    expect(canRemoveContact([phone('a'), phone('b')], 'a')).toEqual({ ok: true });
  });

  it('permite remover perfil social livremente', () => {
    expect(canRemoveContact([phone('a'), social('b')], 'b')).toEqual({ ok: true });
  });

  it('nao se opoe a remover o que nao existe', () => {
    expect(canRemoveContact([phone('a')], 'inexistente')).toEqual({ ok: true });
  });
});

describe('hasReachableContact', () => {
  /** PRD 8.4: rede social nunca pode ser o unico contato. */
  it('exige ao menos um telefone', () => {
    expect(hasReachableContact([social('a'), social('b')])).toBe(false);
    expect(hasReachableContact([phone('a')])).toBe(true);
    expect(hasReachableContact([])).toBe(false);
  });
});

describe('reconcilePrimary', () => {
  /** PRD 8.3: exatamente um principal. */
  it('promove o primeiro telefone quando nenhum e principal', () => {
    expect(reconcilePrimary([phone('a'), phone('b')])).toEqual([
      { id: 'a', isPrimary: true },
      { id: 'b', isPrimary: false },
    ]);
  });

  it('desmarca o anterior ao eleger outro', () => {
    expect(reconcilePrimary([phone('a', { isPrimary: true }), phone('b')], 'b')).toEqual([
      { id: 'a', isPrimary: false },
      { id: 'b', isPrimary: true },
    ]);
  });

  it('mantem o principal existente quando nao ha preferencia', () => {
    expect(reconcilePrimary([phone('a'), phone('b', { isPrimary: true })])).toEqual([
      { id: 'a', isPrimary: false },
      { id: 'b', isPrimary: true },
    ]);
  });

  it('promove outro telefone quando o principal saiu da lista', () => {
    // Situacao apos remover o principal: sobra 'b', que precisa assumir.
    expect(reconcilePrimary([phone('b')])).toEqual([{ id: 'b', isPrimary: true }]);
  });

  it('nunca elege perfil social como principal', () => {
    expect(reconcilePrimary([social('a'), phone('b')], 'a')).toEqual([
      { id: 'a', isPrimary: false },
      { id: 'b', isPrimary: true },
    ]);
  });

  it('deixa tudo sem principal quando nao ha telefone', () => {
    expect(reconcilePrimary([social('a')])).toEqual([{ id: 'a', isPrimary: false }]);
  });

  it('resulta sempre em no maximo um principal', () => {
    const entrada = [phone('a', { isPrimary: true }), phone('b', { isPrimary: true }), social('c')];
    const principais = reconcilePrimary(entrada).filter((item) => item.isPrimary);
    expect(principais).toHaveLength(1);
  });
});

describe('flagDuplicateContacts', () => {
  it('aponta para o primeiro, comparando pelo indice cego', () => {
    const marcados = flagDuplicateContacts([
      { id: 'a', fingerprint: 'x' },
      { id: 'b', fingerprint: 'x' },
      { id: 'c', fingerprint: 'y' },
    ]);
    expect(marcados.map((item) => item.duplicateOfId)).toEqual([null, 'a', null]);
  });
});

describe('isThirdParty', () => {
  /** PRD 8.3: telefone de terceiro exige relacao e autorizacao. */
  it('reconhece as relacoes que caracterizam terceiro', () => {
    expect(isThirdParty('FAMILIAR')).toBe(true);
    expect(isThirdParty('VIZINHO')).toBe(true);
    expect(isThirdParty('OUTRO')).toBe(true);
    expect(isThirdParty('RESPONSAVEL')).toBe(false);
    expect(isThirdParty('MAE')).toBe(false);
  });
});

describe('normalizeHandle', () => {
  it('remove arroba e espaco, preservando a caixa', () => {
    expect(normalizeHandle('  @Maria.Silva ')).toBe('Maria.Silva');
    expect(normalizeHandle('maria_silva')).toBe('maria_silva');
  });

  it('recusa o que nao e handle', () => {
    for (const entrada of ['', '@', '  ', 'maria silva', '<script>', 'a'.repeat(31), null]) {
      expect(normalizeHandle(entrada)).toBeNull();
    }
  });

  it('exibe sempre com arroba', () => {
    expect(formatHandle('maria')).toBe('@maria');
  });

  /** PRD 13.4: contatos mascarados por padrao. */
  it('mascara preservando as duas primeiras letras', () => {
    expect(maskHandle('maria.silva')).toBe('@ma•••••••••');
    expect(maskHandle('ana')).toBe('@•••');
    expect(maskHandle('joao')).toBe('@jo••');
  });
});

describe('phonesAmong', () => {
  it('separa telefones dos demais canais', () => {
    expect(phonesAmong([phone('a'), social('b'), phone('c')]).map((p) => p.id)).toEqual(['a', 'c']);
  });
});
