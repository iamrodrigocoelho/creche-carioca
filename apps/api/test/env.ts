import { resolve } from 'node:path';

/**
 * Ambiente dos testes de integracao.
 *
 * PRD 14.3 exige "API com PostgreSQL real". Os testes rodam contra um banco
 * SEPARADO (`DATABASE_URL_TEST`) porque a suite trunca tabelas entre casos -
 * apontar para o banco de desenvolvimento destruiria dados locais.
 */

const ROOT_ENV_FILES = ['../../../.env', '../../.env'];

export function loadTestEnv(): string {
  for (const file of ROOT_ENV_FILES) {
    try {
      process.loadEnvFile(resolve(__dirname, file));
    } catch {
      // Em CI as variaveis ja vem do ambiente; arquivo ausente e esperado.
    }
  }

  const url = process.env.DATABASE_URL_TEST;

  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST nao definida. Os testes de integracao exigem um banco PostgreSQL dedicado. Veja .env.example.',
    );
  }

  if (url === process.env.DATABASE_URL_ORIGINAL) {
    throw new Error('DATABASE_URL_TEST nao pode apontar para o mesmo banco de desenvolvimento.');
  }

  // A aplicacao le sempre `DATABASE_URL`; o redirecionamento acontece aqui, em um
  // unico lugar, para que nenhum teste precise saber que existe um banco de teste.
  process.env.DATABASE_URL = url;
  process.env.NODE_ENV = 'test';

  return url;
}
