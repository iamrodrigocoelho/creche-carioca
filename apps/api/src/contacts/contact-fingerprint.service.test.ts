import { describe, expect, it } from 'vitest';

import { loadEnv } from '../common/config/env';
import { ContactFingerprintService } from './contact-fingerprint.service';

/**
 * As propriedades que fazem o indice cego valer alguma coisa (ADR-0027).
 */
function comChave(key: string): ContactFingerprintService {
  return new ContactFingerprintService(
    loadEnv({
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      CONTACT_FINGERPRINT_KEY: key,
    } as NodeJS.ProcessEnv),
  );
}

const CHAVE_A = 'a'.repeat(64);
const CHAVE_B = 'b'.repeat(64);
const TELEFONE = '+5521987654321';

describe('ContactFingerprintService', () => {
  it('é determinístico para o mesmo valor e a mesma chave', () => {
    const servico = comChave(CHAVE_A);
    expect(servico.compute('TELEFONE', TELEFONE)).toBe(servico.compute('TELEFONE', TELEFONE));
  });

  it('não devolve o valor: a saída é um digest de tamanho fixo', () => {
    const digest = comChave(CHAVE_A).compute('TELEFONE', TELEFONE);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain('98765');
  });

  /**
   * A razão de ser um HMAC e não um hash: sem segredo, o espaço de telefones
   * brasileiros seria enumerado por força bruta e o índice deixaria de ser cego.
   */
  it('depende da chave', () => {
    expect(comChave(CHAVE_A).compute('TELEFONE', TELEFONE)).not.toBe(
      comChave(CHAVE_B).compute('TELEFONE', TELEFONE),
    );
  });

  it('separa canais: mesmo valor em canais diferentes não colide', () => {
    const servico = comChave(CHAVE_A);
    expect(servico.compute('TELEFONE', 'maria')).not.toBe(
      servico.compute('SOCIAL:INSTAGRAM', 'maria'),
    );
  });

  it('separa plataformas: o mesmo handle em duas redes não é duplicata', () => {
    const servico = comChave(CHAVE_A);
    expect(servico.compute('SOCIAL:INSTAGRAM', 'maria')).not.toBe(
      servico.compute('SOCIAL:TIKTOK', 'maria'),
    );
  });

  it('reconhece o próprio índice e rejeita os demais', () => {
    const servico = comChave(CHAVE_A);
    const digest = servico.compute('TELEFONE', TELEFONE);
    expect(servico.matches(digest, 'TELEFONE', TELEFONE)).toBe(true);
    expect(servico.matches(digest, 'TELEFONE', '+5521911111111')).toBe(false);
    expect(servico.matches('zz', 'TELEFONE', TELEFONE)).toBe(false);
  });

  it('a configuração exige chave de tamanho mínimo', () => {
    expect(() =>
      loadEnv({
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
        CONTACT_FINGERPRINT_KEY: 'curta',
      } as NodeJS.ProcessEnv),
    ).toThrow(/CONTACT_FINGERPRINT_KEY/);
  });
});
