# Deploy no Railway

Procedimento para colocar o Creche Carioca no ar. A topologia e um projeto
Railway com tres recursos: um PostgreSQL gerenciado, o servico `api` (NestJS)
e o servico `web` (Next.js), os dois apontando para este mesmo repositorio.

A infraestrutura e declarada em [`.railway/railway.ts`](../.railway/railway.ts)
usando **Infrastructure as Code**. O Config as Code (`railway.json` /
`railway.toml`) foi descontinuado pelo Railway: servicos novos nao conseguem
mais opta-lo e os arquivos existentes param de funcionar em 2026-12-01.

O arquivo e lido apenas pela CLI. Ele nao tem efeito nenhum no runtime das
aplicacoes, e nada em `apps/*` ou `packages/*` depende dele.

## Pre-requisitos

CLI do Railway na versao **5.42.1 ou superior**. O subcomando `config` so
existe a partir dela; uma CLI mais antiga falha assim, mesmo com o projeto ja
vinculado com sucesso:

```
error: unrecognized subcommand 'config'
```

Se for o caso, atualize antes de qualquer outra coisa:

```
railway upgrade
railway --version    # precisa ser >= 5.42.1
```

Instalacao do zero, se ainda nao houver CLI:

```
npm i -g @railway/cli
railway login
```

## 1. Vincular o projeto

Na raiz do repositorio:

```
railway init      # cria o projeto, se ainda nao existir
railway link      # vincula este diretorio a um projeto e ambiente
```

## 2. Definir o segredo do indice cego

A `api` nao sobe sem `CONTACT_FINGERPRINT_KEY`. E a chave do indice cego de
contatos (ADR-0028): o schema de configuracao a exige com pelo menos 32
caracteres e nao tem valor padrao de proposito, porque uma chave versionada
seria publica e um indice cego com chave publica nao esconde nada.

Por isso ela nao esta em `.railway/railway.ts` como valor, e sim como
`preserve()`: o arquivo declara que a variavel existe e que o `apply` nao deve
toca-la. O valor e definido uma unica vez, aqui:

```
railway variables --service api --set "CONTACT_FINGERPRINT_KEY=$(openssl rand -hex 32)"
```

Faca isso **antes** do primeiro `apply`. Sem a variavel, o processo lanca
`Configuracao invalida: CONTACT_FINGERPRINT_KEY: ...` antes de escutar na
porta, o healthcheck reprova e o Railway mantem a versao anterior no ar - com
a api antiga respondendo `Cannot POST /applications/:id/contacts/phones`
enquanto o `web`, que implanta separado, ja mostra a etapa de contatos.

A chave **nao tem rotacao**: troca-la invalida todos os indices ja gravados e a
deteccao de telefone repetido para de funcionar para os contatos antigos ate
serem reescritos (docs/DECISIONS.md, ADR-0028).

## 3. Planejar e aplicar

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

## 4. Gerar os dominios publicos

O nome do dominio so existe depois que o Railway o gera, entao ele nao pode ser
declarado no arquivo. Mas nao precisa ser feito no painel:

```
railway domain --service api --port 3333
railway domain --service web --port 3000
```

O `--port` e o _target port_, e nao e opcional:

| Servico | Target port | Por que                                                      |
| ------- | ----------- | ------------------------------------------------------------ |
| `api`   | `3333`      | default de `API_PORT` em `apps/api/src/common/config/env.ts` |
| `web`   | `3000`      | o script fixa `next start --port 3000` e ignora `PORT`       |

Sem o target port correto o proxy do Railway aponta para a porta errada e a
resposta e 502.

Equivalente no painel: `Settings` -> `Networking` -> `Generate Domain`.

## 4b. Ligar um dominio proprio (opcional)

O projeto usa `crechecarioca.rio.br`, com DNS no Hostinger. O dominio gerado
pelo Railway continua existindo e respondendo depois disso - e por ele que se
testa o `web` quando o DNS proprio esta propagando ou quebrado.

1. Painel do Railway, servico `web` -> `Settings` -> `Networking` ->
   `Custom Domain`, ou `railway domain --service web --port 3000 <dominio>`.
   O `--port` continua sendo o _target port_ da tabela acima.
2. O Railway devolve um alvo `<id>.up.railway.app`. No DNS do Hostinger,
   crie um `CNAME` do subdominio para esse alvo. Apague qualquer `CNAME` ou
   `A` anterior do mesmo nome - o `www` vinha apontando para `cdn.hstgr.net`.
3. Espere o Railway marcar o dominio como ativo (ele emite o TLS sozinho,
   depois de enxergar o registro).

Apex (`crechecarioca.rio.br`) nao aceita `CNAME`: o registro dele e um `A`
para o edge do Railway, informado pelo painel no momento em que o dominio e
adicionado. Nao invente esse IP a partir de um `dig` - ele muda.

Conferindo a propagacao:

```
dig +short www.crechecarioca.rio.br    # espera-se <id>.up.railway.app
dig +short crechecarioca.rio.br        # espera-se o IP do edge do Railway
```

Um `dig` que devolve `cdn.hstgr.net` significa que o registro antigo do
Hostinger ainda esta na zona ou no cache.

**As origens ficam no `.railway/railway.ts`, nao na CLI.** `WEB_CUSTOM_ORIGINS`
alimenta o `API_CORS_ORIGINS` da api e `API_CUSTOM_ORIGIN` alimenta o
`NEXT_PUBLIC_API_URL` do web. Setar essas variaveis com
`railway variables --set` funciona ate o proximo `railway config apply`, que
restaura o valor declarado no arquivo e derruba o CORS do dominio proprio.

Dominio proprio na api exige o passo 5: `NEXT_PUBLIC_API_URL` e lida em tempo
de build.

## 5. Redeploy do `web`

Obrigatorio, e a razao e especifica: `NEXT_PUBLIC_API_URL` e lida em tempo de
**build**. O valor entra no bundle e no `connect-src` da CSP montada por
`apps/web/next.config.mjs`. Como a variavel referencia o dominio da api, que
so passou a existir no passo 4, o primeiro build do `web` foi feito sem ela.

```
railway redeploy --service web --from-source
```

O `--from-source` e essencial: `railway redeploy` sozinho reimplanta a build
que ja existe, sem reconstrui-la, e portanto mantem o valor antigo assado no
bundle. Só o `--from-source` refaz o build a partir do commit.

Equivalente no painel: servico `web` -> menu do deploy -> `Redeploy`.

Trocar essa variavel sem rebuildar nunca tem efeito: a CSP antiga continua
bloqueando as chamadas.

## 6. Verificar

```
curl -s https://<dominio-da-api>/health/ready
```

Esperado: `{"status":"ready", ...}` com `postgres: up`. Um `503` com
`postgres: down` significa que a `DATABASE_URL` nao esta resolvendo.

Depois, abrir o `web` e enviar uma inscricao em `/inscricao` - e o caminho que
exercita web -> CORS -> api -> PostgreSQL de ponta a ponta. Va ate a etapa de
contatos e salve um telefone: e o unico passo da jornada que depende de
`CONTACT_FINGERPRINT_KEY`, e um `Cannot POST .../contacts/phones` ali significa
que a api ao vivo e uma build anterior, mantida no ar por um deploy reprovado.

## Alterar a infraestrutura depois

Editar `.railway/railway.ts` e rodar `plan` / `apply` de novo. O arquivo e
diferenciado contra o ambiente ao vivo; nao ha arquivo de estado para
sincronizar ou divergir.

## Pontos de atencao

**Um deploy reprovado deixa a versao ANTERIOR no ar.** O Railway so troca o
deployment ativo quando o healthcheck passa, entao uma api que nao inicia nao
derruba o site - ela some do diff. Como `api` e `web` implantam separados, o
front novo passa a conversar com a api velha, e o erro aparece como rota
inexistente (`Cannot POST /applications/:id/contacts/phones`) e nao como falha
de configuracao. Ao ver 404 numa rota que existe no codigo, confira primeiro os
logs do ultimo deploy da `api` e o commit da build ativa.

**`/health/ready` responde 503 sem banco.** E o healthcheck da `api`, e o
PostgreSQL e dependencia critica. Uma `DATABASE_URL` errada reprova o deploy e
dispara rollback, em vez de publicar uma API que quebra na primeira escrita.

**`PORT` e o que o healthcheck sonda, nao o target port do dominio.** Sao duas
coisas diferentes: o target port resolve o roteamento publico, e a variavel
`PORT` diz ao Railway em que porta sondar o conteiner por dentro da rede. Sem
declarar `PORT`, o Railway sonda a porta que ele injeta - na qual nenhuma das
duas aplicacoes escuta - e o deploy reprova no healthcheck com a aplicacao no
ar e saudavel. O dominio publico passa a responder:

```
{"status":"error","code":404,"message":"Application not found"}
```

Isso e o rollback: sem deployment ativo, o roteador nao tem para onde mandar. E
o mesmo sintoma de "servico nunca existiu", o que torna o diagnostico enganoso.

Por isso `PORT` esta declarado explicitamente nos dois servicos em
`.railway/railway.ts`, com o mesmo valor do target port de cada um.

**O builder e o Railpack, nao o Nixpacks.** O Nixpacks esta descontinuado no
Railway, e a imagem dele embute um corepack antigo demais para o pnpm 11.1.3,
que usa `import()` dinamico no entrypoint CJS. Com ele o build morre no
`pnpm i --frozen-lockfile`, antes de qualquer codigo do repositorio rodar:

```
TypeError [ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING]: A dynamic import callback
was not specified.
    at Object.<anonymous> (/root/.cache/node/corepack/pnpm/11.1.3/bin/pnpm.cjs)
```

O sintoma nao aponta para a causa - parece problema de Node ou de lockfile, e
nao e nenhum dos dois. Se esse erro aparecer, confira se o servico nao voltou
para o Nixpacks.

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

O seed roda automaticamente no `preDeploy`, junto das migrations
(`pnpm db:deploy && pnpm db:seed`). Nao ha etapa manual.

Ele nao e conveniencia de desenvolvimento: sem o processo `DEMO-2026` e a
versao da regra de grupamento, a API recusa toda inscricao e a aplicacao fica
inutilizavel, com esta mensagem no formulario:

```
Processo seletivo nao disponivel nesta demonstracao.
```

Um banco recem-criado sobe exatamente assim - com schema e vazio -, entao o
primeiro deploy de qualquer ambiente novo caía nisso.

Rodar a cada release e seguro porque o seed e idempotente por construcao:
`upsert` no processo, e recusa sobrescrever uma regra ja publicada (PRD 8.7).
Ele tambem nao cria nenhum dado pessoal (PRD 1.2) - apenas o processo de
demonstracao e a regra de grupamento etario.

Para rodar sob demanda, sem esperar um release:

```
railway ssh --service api pnpm --filter @match/database run db:seed
```
