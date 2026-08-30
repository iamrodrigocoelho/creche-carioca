# Match Perfeito

Protótipo de demonstração para a inscrição, classificação e convocação de vagas em creches e Espaços de Desenvolvimento Infantil do Município do Rio de Janeiro.

> **Não é o sistema oficial de matrícula.** Todos os dados são sintéticos ou anonimizados e não representam a realidade do município. Não utilize dados pessoais reais.

## Documentos de referência

| Documento                                          | Papel                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| [`PRD.md`](PRD.md)                                 | Fonte de verdade de comportamento, regras de negócio e requisitos técnicos |
| [`docs/DESIGN.md`](docs/DESIGN.md)                 | Fonte de verdade da identidade visual e dos componentes                    |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Plano incremental de fases e o que já foi entregue                         |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)           | ADRs, decisões provisórias e o que permanece em aberto                     |

## Estado atual

**Fase 3 concluída** — fundação técnica, a primeira fatia funcional ponta a ponta, a persistência canônica em PostgreSQL e o pipeline de dados históricos. A família informa mês e ano de nascimento e o turno desejado, e recebe o grupamento etário com a explicação de como ele foi obtido; a inscrição é gravada de forma transacional, com histórico de status e trilha de auditoria append-only. Os cinco processos seletivos de 2021 a 2025 são ingeridos em DuckDB e publicados como tabelas curadas em Parquet, com manifesto e relatório de qualidade. As demais fases estão descritas no `IMPLEMENTATION_PLAN.md`.

## Requisitos

- Node.js **22 LTS** (veja `.nvmrc`)
- pnpm **11+**
- **PostgreSQL 16+**, via `docker compose up -d` ou uma instalação local

## Banco de dados

Suba o PostgreSQL com o compose deste repositório:

```bash
docker compose up -d
```

Ou use um PostgreSQL local. Em qualquer caso, crie os dois bancos — o de testes precisa ser **separado**, porque a suíte trunca tabelas:

```bash
createdb match_perfeito
createdb match_perfeito_test
```

Ajuste `DATABASE_URL` e `DATABASE_URL_TEST` no `.env` e aplique o schema:

```bash
pnpm db:deploy    # aplica as migrations
pnpm db:seed      # publica o processo de demonstração e a regra de grupamento
```

Outros comandos: `pnpm db:migrate` (cria migration em desenvolvimento), `pnpm db:status`, `pnpm db:studio`.

## Estrutura

```text
apps/
  api/        API HTTP NestJS
  web/        Jornada da família em Next.js
packages/
  domain/     Entidades e regras puras, sem I/O nem framework
  schemas/    Contratos Zod compartilhados entre API e web
  ui/         Tokens e componentes de docs/DESIGN.md
  database/   Schema Prisma, migrations, seed e cliente PostgreSQL
  data-pipeline/  Ingestão DuckDB dos datasets históricos e tabelas curadas
data/
  raw/        Datasets da SME/RJ — não versionados, veja "Dados históricos"
  curated/    Saída do pipeline, uma pasta por versão de importação
docs/
img/logo/     Logotipos oficiais — única fonte autorizada
```

## Dados históricos

Os datasets da SME/RJ **não são versionados** — são centenas de MB e estão publicados
em [CIT-SME-RJ/dadoscreche](https://github.com/CIT-SME-RJ/dadoscreche). Baixe para
`data/raw/`, preservando os nomes de diretório:

```text
data/raw/
  01_QueryA_InscricoesPorAno.csv.gz            837.179 inscrições
  02_QueryB_RespostasSocioEconomicas.csv.gz    4.357.119 respostas
  03_QueryC_PerguntasComDescricao.csv          catálogo de perguntas e pesos
  04_UnidadesEscolaresComEndereco.csv          2.188 unidades (sem cabeçalho)
  oferecimentos/Unidades_Unificadas_com_Localizacao.xlsx   coordenadas, CRE, microárea
  microareas/Microareas_SME_revisao.shp        polígonos das microáreas (+ arquivos irmãos)
```

Para publicar as tabelas curadas:

```bash
pnpm --filter @match/data-pipeline build
pnpm --filter @match/data-pipeline ingest
```

A execução leva cerca de 8 segundos sobre os 5,2 milhões de linhas e escreve em
`data/curated/<versao>/`: um Parquet por tabela, o `manifest.json` com o SHA-256 de
cada arquivo de origem e o `relatorio-qualidade.json`. **O pipeline nunca sobrescreve
uma versão existente** — reimportar exige apagar a pasta ou escolher outra versão.

Sem os arquivos, a ingestão falha com a instrução de download em vez de produzir dados
vazios. Os testes não dependem deles: rodam sobre fixtures versionadas em
`packages/data-pipeline/test/fixtures/`, regeráveis com `pnpm --filter
@match/data-pipeline fixtures` quando a origem mudar.

O relatório de qualidade classifica dez achados por severidade e registra, entre
outras coisas, que `esc_codigo` não é uma chave única na origem e que 20 unidades
citadas nas inscrições não têm coordenada conhecida. As decisões tomadas diante disso
estão em `docs/DECISIONS.md` (ADR-0018 a ADR-0022).

## Como executar

```bash
pnpm install
cp .env.example .env      # nenhum valor do exemplo é segredo real
```

Suba os dois processos em terminais separados:

```bash
pnpm --filter @match/api dev     # http://localhost:3333
pnpm --filter @match/web dev     # http://localhost:3000
```

Abra <http://localhost:3000> e siga para **Iniciar inscrição**.

Para rodar em modo produção local:

```bash
pnpm build
pnpm --filter @match/api start
pnpm --filter @match/web start
```

## Verificação

```bash
pnpm verify            # lint + typecheck + test + build
```

Ou individualmente:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage     # PRD 14.1: mínimo de 90% em `domain`
pnpm build
pnpm e2e               # Playwright; requer `pnpm build` antes
```

O primeiro `pnpm e2e` precisa do navegador:

```bash
pnpm --filter @match/web exec playwright install chromium
```

## Endpoints disponíveis

| Método  | Rota                | Descrição                                                        |
| ------- | ------------------- | ---------------------------------------------------------------- |
| `GET`   | `/health/live`      | Processo vivo                                                    |
| `GET`   | `/health/ready`     | Dependências críticas; responde 503 se o PostgreSQL estiver fora |
| `POST`  | `/applications`     | Cria a inscrição; aceita `Idempotency-Key`                       |
| `GET`   | `/applications/:id` | Consulta por UUID                                                |
| `PATCH` | `/applications/:id` | Atualiza entradas e recalcula o grupamento                       |

Exemplo:

```bash
curl -s http://localhost:3333/applications \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: exemplo-manual-001' \
  -d '{"processId":"DEMO-2026","child":{"birthYear":2024,"birthMonth":3},"desiredShift":"INTEGRAL"}'
```

## Segurança e privacidade

- Nenhum segredo é versionado. `.env` está no `.gitignore`; apenas `.env.example` é rastreado.
- CORS opera por allowlist explícita, nunca por curinga.
- Logs são JSON estruturados com redação automática de campos sensíveis; PII não é registrada.
- Erros não expõem stack trace nem ecoam o valor recebido do usuário.
- Referências públicas usam UUID v4, não identificadores sequenciais.
- Nenhuma mensagem real é enviada: todos os canais de comunicação são simulados.
- A trilha de auditoria é append-only, garantida por trigger no PostgreSQL — nem um administrador do banco consegue apagá-la.

Detalhes e decisões pendentes estão em [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Convenções

- TypeScript `strict` em todo o repositório; nenhuma outra linguagem no produto ou no pipeline de dados.
- Nenhum LLM participa do cálculo de pontuação, prioridade ou alocação de vagas.
- Valores visuais vêm de tokens de `@match/ui`; nenhum hex é escrito fora desse pacote.
- Logotipos são carregados de `/img/logo` sem qualquer alteração.
