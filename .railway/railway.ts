/**
 * Infraestrutura do Match Perfeito no Railway (PRD 19).
 *
 * Substitui o Config as Code (`railway.json`), descontinuado pelo Railway:
 * servicos novos nao conseguem mais opta-lo, e os arquivos existentes param de
 * funcionar em 2026-12-01.
 *
 * O arquivo e lido apenas pela CLI (`railway config plan` / `apply`) e nao tem
 * efeito no runtime das aplicacoes.
 *
 * PRD 13.4: nenhum segredo aqui. `DATABASE_URL` e uma referencia resolvida pelo
 * Railway, nao um valor.
 */
import { defineRailway, github, postgres, project, service } from 'railway/iac';

const REPO = 'iamrodrigocoelho/creche-carioca';
const BRANCH = 'main';

/**
 * O build roda a partir da raiz do repositorio, nao de `apps/*`: o workspace
 * pnpm precisa do `pnpm-lock.yaml` e de `packages/*` para resolver as
 * dependencias `workspace:*`.
 */
const ROOT_DIRECTORY = '/';

/** Um push que so toca o front nao precisa redeployar a API, e vice-versa. */
const SHARED_WATCH = ['packages/**', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'turbo.json'];

export default defineRailway(() => {
  const db = postgres('postgres');

  const api = service('api', {
    source: github(REPO, { branch: BRANCH, rootDirectory: ROOT_DIRECTORY }),
    build: {
      /**
       * Railpack, nao Nixpacks: o Nixpacks esta descontinuado no Railway e a
       * imagem dele embute um corepack antigo demais para o pnpm 11.1.3, que
       * usa `import()` dinamico no entrypoint CJS. O sintoma e o install
       * falhar com ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING antes de qualquer
       * codigo do repositorio rodar.
       */
      builder: 'RAILPACK',
      buildCommand: 'pnpm exec turbo run build --filter=@match/api',
      watchPatterns: ['apps/api/**', ...SHARED_WATCH],
    },
    start: 'pnpm --filter @match/api start',
    /** Aplica as migrations antes de cada release. */
    preDeploy: 'pnpm db:deploy',
    /**
     * `/health/ready` responde 503 enquanto o PostgreSQL estiver inacessivel,
     * entao uma `DATABASE_URL` errada reprova o deploy em vez de publicar uma
     * API que quebra na primeira escrita.
     */
    healthcheck: '/health/ready',
    healthcheckTimeout: 120,
    env: {
      NODE_ENV: 'production',
      API_LOG_LEVEL: 'info',
      /** Referencia tipada ao Postgres do projeto - resolvida pelo Railway. */
      DATABASE_URL: db.env.DATABASE_URL,
      /**
       * Allowlist de CORS (PRD 13.5). Resolvido pelo Railway a partir do
       * dominio publico do `web`, que precisa existir - ver docs/DEPLOY.md.
       */
      API_CORS_ORIGINS: 'https://${{web.RAILWAY_PUBLIC_DOMAIN}}',
    },
  });

  const web = service('web', {
    source: github(REPO, { branch: BRANCH, rootDirectory: ROOT_DIRECTORY }),
    build: {
      /**
       * Railpack, nao Nixpacks: o Nixpacks esta descontinuado no Railway e a
       * imagem dele embute um corepack antigo demais para o pnpm 11.1.3, que
       * usa `import()` dinamico no entrypoint CJS. O sintoma e o install
       * falhar com ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING antes de qualquer
       * codigo do repositorio rodar.
       */
      builder: 'RAILPACK',
      buildCommand: 'pnpm exec turbo run build --filter=@match/web',
      watchPatterns: ['apps/web/**', ...SHARED_WATCH],
    },
    start: 'pnpm --filter @match/web start',
    healthcheck: '/',
    healthcheckTimeout: 120,
    env: {
      NODE_ENV: 'production',
      /**
       * Lida em tempo de BUILD: entra no bundle e no `connect-src` da CSP
       * montada por apps/web/next.config.mjs. Alterar esta variavel exige
       * rebuild do `web` - trocar o valor sozinho nao tem efeito.
       */
      NEXT_PUBLIC_API_URL: 'https://${{api.RAILWAY_PUBLIC_DOMAIN}}',
    },
  });

  return project('match-perfeito', { resources: [db, api, web] });
});
