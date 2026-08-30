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

**Fase 1 concluída** — fundação técnica e a primeira fatia funcional ponta a ponta: a família informa mês e ano de nascimento e o turno desejado, e recebe o grupamento etário com a explicação de como ele foi obtido. As demais fases estão descritas no `IMPLEMENTATION_PLAN.md`.

## Requisitos

- Node.js **22 LTS** (veja `.nvmrc`)
- pnpm **11+**

Docker ainda não é necessário: a Fase 1 não usa banco de dados. Ele passa a ser exigido a partir da Fase 2.

## Estrutura

```text
apps/
  api/        API HTTP NestJS
  web/        Jornada da família em Next.js
packages/
  domain/     Entidades e regras puras, sem I/O nem framework
  schemas/    Contratos Zod compartilhados entre API e web
  ui/         Tokens e componentes de docs/DESIGN.md
prisma/       (Fase 2)
docs/
img/logo/     Logotipos oficiais — única fonte autorizada
```

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

| Método  | Rota                | Descrição                                  |
| ------- | ------------------- | ------------------------------------------ |
| `GET`   | `/health/live`      | Processo vivo                              |
| `GET`   | `/health/ready`     | Dependências críticas                      |
| `POST`  | `/applications`     | Cria a inscrição; aceita `Idempotency-Key` |
| `GET`   | `/applications/:id` | Consulta por UUID                          |
| `PATCH` | `/applications/:id` | Atualiza entradas e recalcula o grupamento |

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

Detalhes e decisões pendentes estão em [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Convenções

- TypeScript `strict` em todo o repositório; nenhuma outra linguagem no produto ou no pipeline de dados.
- Nenhum LLM participa do cálculo de pontuação, prioridade ou alocação de vagas.
- Valores visuais vêm de tokens de `@match/ui`; nenhum hex é escrito fora desse pacote.
- Logotipos são carregados de `/img/logo` sem qualquer alteração.
