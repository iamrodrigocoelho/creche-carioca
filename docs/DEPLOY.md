# Deploy no Railway

Procedimento para colocar o Match Perfeito no ar. A topologia e um projeto
Railway com tres recursos: um PostgreSQL gerenciado, o servico `api` (NestJS)
e o servico `web` (Next.js), os dois apontando para este mesmo repositorio.

A infraestrutura e declarada em [`.railway/railway.ts`](../.railway/railway.ts)
usando **Infrastructure as Code**. O Config as Code (`railway.json` /
`railway.toml`) foi descontinuado pelo Railway: servicos novos nao conseguem
mais opta-lo e os arquivos existentes param de funcionar em 2026-12-01.

O arquivo e lido apenas pela CLI. Ele nao tem efeito nenhum no runtime das
aplicacoes, e nada em `apps/*` ou `packages/*` depende dele.

## Pre-requisitos

CLI do Railway na versao **5.42.1 ou superior** - versoes anteriores usam o
motor TypeScript antigo e recusam o arquivo:

```
npm i -g @railway/cli
railway --version
railway login
```

## 1. Vincular o projeto

Na raiz do repositorio:

```
railway init      # cria o projeto, se ainda nao existir
railway link      # vincula este diretorio a um projeto e ambiente
```

## 2. Planejar e aplicar

```
railway config plan     # mostra o diff contra o ambiente vinculado
railway config apply    # aplica, pedindo confirmacao
```

O `plan` e sempre nao destrutivo. O `apply` pede confirmacao interativa, e
remocao de recursos ou variaveis exige `--confirm-destructive` adicionalmente -
um `--yes` distraido nao apaga infraestrutura.

Isso cria o PostgreSQL e os dois servicos, com build, start, pre-deploy,
healthcheck, watch paths e variaveis ja definidos. A `DATABASE_URL` da api e
uma referencia ao Postgres do projeto, resolvida pelo Railway - nao ha
credencial no repositorio (PRD 13.4).

## 3. Gerar os dominios publicos

Este passo e manual, no painel: o nome do dominio so existe depois que o
Railway o gera, entao ele nao pode ser declarado no arquivo.

Em cada servico, `Settings` -> `Networking` -> `Generate Domain`, definindo o
**target port**:

| Servico | Target port | Por que                                                      |
| ------- | ----------- | ------------------------------------------------------------ |
| `api`   | `3333`      | default de `API_PORT` em `apps/api/src/common/config/env.ts` |
| `web`   | `3000`      | o script fixa `next start --port 3000` e ignora `PORT`       |

Sem o target port correto o proxy do Railway aponta para a porta errada e a
resposta e 502.

## 4. Redeploy do `web`

Obrigatorio, e a razao e especifica: `NEXT_PUBLIC_API_URL` e lida em tempo de
**build**. O valor entra no bundle e no `connect-src` da CSP montada por
`apps/web/next.config.mjs`. Como a variavel referencia o dominio da api, que
so passou a existir no passo 3, o primeiro build do `web` foi feito sem ela.

No painel, servico `web` -> menu do deploy -> `Redeploy`.

Trocar essa variavel sem rebuildar nunca tem efeito: a CSP antiga continua
bloqueando as chamadas.

## 5. Verificar

```
curl -s https://<dominio-da-api>/health/ready
```

Esperado: `{"status":"ready", ...}` com `postgres: up`. Um `503` com
`postgres: down` significa que a `DATABASE_URL` nao esta resolvendo.

Depois, abrir o `web` e enviar uma inscricao em `/inscricao` - e o caminho que
exercita web -> CORS -> api -> PostgreSQL de ponta a ponta.

## Alterar a infraestrutura depois

Editar `.railway/railway.ts` e rodar `plan` / `apply` de novo. O arquivo e
diferenciado contra o ambiente ao vivo; nao ha arquivo de estado para
sincronizar ou divergir.

## Pontos de atencao

**`/health/ready` responde 503 sem banco.** E o healthcheck da `api`, e o
PostgreSQL e dependencia critica. Uma `DATABASE_URL` errada reprova o deploy e
dispara rollback, em vez de publicar uma API que quebra na primeira escrita.

**As migrations rodam sozinhas.** O `preDeploy` executa `pnpm db:deploy`
(`prisma migrate deploy`) antes de cada release.

**O build roda da raiz do repositorio.** `rootDirectory` e `/`, nao `apps/*`:
o workspace pnpm precisa do `pnpm-lock.yaml` e de `packages/*` para resolver as
dependencias `workspace:*`.

**`NODE_ENV=production` e seguro no install.** O pnpm 11 nao poda
`devDependencies` por causa dessa variavel, entao `turbo`, `tsc`, `prisma` e
`next` continuam disponiveis no build. Em producao ela liga o HSTS
(`apps/api/src/bootstrap.ts`) e desliga o log de queries do Prisma
(`apps/api/src/database/prisma.service.ts`).

**O SDK `railway` e dependencia de desenvolvimento.** Serve para o
`.railway/railway.ts` typecheckar e para a CLI resolver o import. Ele traz o
esbuild como dependencia transitiva, cujo script de instalacao esta **negado**
em `pnpm-workspace.yaml` (`allowBuilds: esbuild: false`): nada no repositorio
executa esbuild, e a politica de supply chain do PRD 13.7 segue restritiva.

## Seed

O `db:seed` nao roda automaticamente. Para popular os dados de referencia,
uma vez, pelo shell do Railway no servico `api`:

```
pnpm --filter @match/database run db:seed
```
