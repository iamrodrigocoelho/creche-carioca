import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

import { loadTestEnv } from './env';

/**
 * Prepara o banco de teste uma unica vez por execucao da suite.
 *
 * Aplica as migrations versionadas (nao `db push`) para que o schema testado
 * seja exatamente o que sera aplicado em qualquer outro ambiente - PRD 14.3 pede
 * "Prisma migrations e rollback quando suportado".
 */
export default function setup(): void {
  const databaseUrl = loadTestEnv();

  const require_ = createRequire(__filename);
  const prismaPackage = require_.resolve('prisma/package.json');
  const prismaBin = resolve(dirname(prismaPackage), 'build/index.js');
  const databasePackage = dirname(require_.resolve('@match/database/package.json'));

  execFileSync(process.execPath, [prismaBin, 'migrate', 'deploy'], {
    cwd: databasePackage,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
