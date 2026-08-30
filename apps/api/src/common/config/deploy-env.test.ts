import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { envSchema } from './env';

/**
 * A configuracao do deploy precisa declarar tudo o que a API exige para subir.
 *
 * Uma variavel obrigatoria ausente em `.railway/railway.ts` nao quebra nenhum
 * teste e nenhum build: ela derruba a API na inicializacao, o healthcheck
 * reprova o deploy e o Railway mantem a build ANTERIOR no ar. Como `api` e
 * `web` implantam separados, o sintoma chega mascarado - o front novo chamando
 * a api velha recebe 404 numa rota que existe no codigo
 * (`Cannot POST /applications/:id/contacts/phones`, quando
 * `CONTACT_FINGERPRINT_KEY` ficou de fora na Fase 5).
 *
 * O teste le o arquivo como texto de proposito: `railway/iac` e dependencia da
 * raiz e nao resolve a partir de `apps/api`, e o que interessa aqui e apenas
 * que a chave conste do arquivo - o valor de cada uma e do ambiente.
 */
const REPO_ROOT = resolve(__dirname, '../../../../..');
const RAILWAY_FILE = resolve(REPO_ROOT, '.railway/railway.ts');

/** Sem padrao no schema: a API nao inicia sem elas. */
function requiredEnvKeys(): string[] {
  const result = envSchema.safeParse({});
  if (result.success) return [];

  return [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
}

describe('configuracao do deploy', () => {
  const railwayFile = readFileSync(RAILWAY_FILE, 'utf8');

  it('exige ao menos uma variavel sem padrao', () => {
    // Guarda o proprio teste: se o schema deixar de ter obrigatorias, a
    // verificacao abaixo passaria vazia sem verificar nada.
    expect(requiredEnvKeys().length).toBeGreaterThan(0);
  });

  it.each(requiredEnvKeys())('declara %s no servico api do Railway', (key) => {
    expect(railwayFile).toMatch(new RegExp(`^\\s*${key}:`, 'm'));
  });
});
