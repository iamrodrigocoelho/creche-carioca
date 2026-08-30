# Deploy no Railway

Procedimento para colocar o Match Perfeito no ar. A topologia e um projeto
Railway com tres recursos: um PostgreSQL gerenciado, o servico `api`
(NestJS) e o servico `web` (Next.js), os dois apontando para este mesmo
repositorio.

Os arquivos `apps/api/railway.json` e `apps/web/railway.json` trazem build,
start, pre-deploy e healthcheck de cada servico. Nenhuma configuracao
existente do repositorio precisou ser alterada para o deploy - `turbo.json`,
`package.json` e os scripts continuam como estavam.

## Ordem de execucao

A ordem importa: `NEXT_PUBLIC_API_URL` e `API_CORS_ORIGINS` so podem ser
preenchidas depois que as URLs publicas existirem.

### 1. PostgreSQL

No projeto Railway, `New` -> `Database` -> `Add PostgreSQL`. Ele passa a
expor a referencia `${{Postgres.DATABASE_URL}}`, usada pela api.

### 2. Servico `api`

`New` -> `GitHub Repo` -> este repositorio.

- **Settings -> Config as code**: `apps/api/railway.json`
- **Settings -> Networking**: `Generate Domain`
- **Variables**:

  | Variavel           | Valor                        |
  | ------------------ | ---------------------------- |
  | `DATABASE_URL`     | `${{Postgres.DATABASE_URL}}` |
  | `API_PORT`         | `${{PORT}}`                  |
  | `NODE_ENV`         | `production`                 |
  | `API_CORS_ORIGINS` | preencher no passo 4         |

`API_PORT=${{PORT}}` faz a API escutar na porta que o Railway injeta. A
alternativa e fixar `API_PORT=3333` e declarar 3333 como _target port_ em
Networking; a referencia e menos fragil.

O `preDeployCommand` roda `pnpm db:deploy` (`prisma migrate deploy`) antes de
cada release, entao as migrations sao aplicadas automaticamente.

### 3. Servico `web`

`New` -> `GitHub Repo` -> o mesmo repositorio, como um segundo servico.

- **Settings -> Config as code**: `apps/web/railway.json`
- **Settings -> Networking**: `Generate Domain` e definir **target port
  `3000`**. O script `start` fixa `next start --port 3000` e ignora `PORT`,
  entao esse campo e obrigatorio.
- **Variables**:

  | Variavel              | Valor                                                          |
  | --------------------- | -------------------------------------------------------------- |
  | `NEXT_PUBLIC_API_URL` | URL publica da api (passo 2), com `https://` e sem barra final |
  | `NODE_ENV`            | `production`                                                   |

### 4. Fechar o circulo do CORS

De volta ao servico `api`, definir `API_CORS_ORIGINS` com a URL publica do
`web`. A allowlist e explicita e o default e `http://localhost:3000`; sem
esse passo o navegador bloqueia toda chamada em producao.

Depois disso, **redeploy do `web`**. Ver a proxima secao.

## Pontos de atencao

**`NEXT_PUBLIC_API_URL` e build-time, nao runtime.** O valor e assado no
bundle e tambem na CSP montada por `apps/web/next.config.mjs`
(`connect-src`). Trocar a variavel sem rebuildar o `web` nao tem efeito
nenhum: a CSP antiga continua bloqueando a API nova. Toda alteracao dessa
variavel exige um redeploy do `web`.

**`/health/ready` responde 503 sem banco.** E o healthcheck do servico `api`,
e o Postgres e dependencia critica. Se `DATABASE_URL` estiver errada, o
deploy falha no healthcheck e o Railway faz rollback - o comportamento
desejado, mas a causa raiz aparece no healthcheck, nao no log de boot.

**Os dois servicos compartilham o repositorio.** Por padrao um push
redeploya ambos. Para evitar, configurar _watch paths_ em cada servico
(`apps/api/**` e `packages/**` para a api; `apps/web/**` e `packages/**`
para o web).

**`NODE_ENV=production` e seguro no install.** Foi verificado que o pnpm 11
nao poda `devDependencies` por causa dessa variavel - `turbo`, `tsc`,
`prisma` e `next` continuam disponiveis no build. Em producao a variavel
liga o HSTS (`apps/api/src/bootstrap.ts`) e desliga o log de queries do
Prisma (`apps/api/src/database/prisma.service.ts`), entao vale mante-la.

## Seed

O `db:seed` nao roda automaticamente. Para popular os dados de referencia,
executar uma vez pelo shell do Railway no servico `api`:

```
pnpm --filter @match/database run db:seed
```

O comando depende do build de `packages/database` (`dist/seed.js`), ja
produzido pelo build da api.
