import { defineConfig } from 'prisma/config';

/**
 * Configuração do Prisma CLI (Prisma 7).
 *
 * A partir do Prisma 7 a URL de conexão saiu do `schema.prisma`. Ela vive aqui
 * para os comandos de migração e no driver adapter em tempo de execução — em
 * ambos os casos vinda do ambiente, nunca do repositório (PRD 13.4).
 *
 * O Prisma 7 também deixou de carregar `.env` automaticamente. O carregamento
 * abaixo usa o suporte nativo do Node e é silencioso quando o arquivo não
 * existe, para não quebrar CI, onde as variáveis já vêm do ambiente.
 */
for (const envFile of ['../../.env', '.env']) {
  try {
    process.loadEnvFile(new URL(envFile, import.meta.url).pathname);
  } catch {
    // Arquivo ausente é esperado em CI e em execuções com ambiente explícito.
  }
}

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node dist/seed.js',
  },
  // Omitido quando ausente para que `prisma generate` — que não toca no banco —
  // funcione sem configuração. Os comandos de migração falham com a mensagem do
  // próprio Prisma, que já indica o que falta.
  ...(url ? { datasource: { url } } : {}),
});
