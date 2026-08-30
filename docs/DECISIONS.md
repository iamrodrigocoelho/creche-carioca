# DECISIONS.md — Registro de decisões arquiteturais

Formato: ADR curto. Cada entrada registra **contexto → decisão → consequências**, com a referência ao `PRD.md` ou ao `/docs/DESIGN.md` que a motivou.

Uma decisão só é revista com um novo ADR; entradas antigas não são reescritas.

**Status possíveis:** `Aceita`, `Provisória`, `Substituída`, `Revogada`.

---

## ADR-0001 — pnpm workspaces + Turborepo

**Status:** Aceita · Fase 1

**Contexto.** `PRD.md` §12.1 define pnpm workspaces e Turborepo como stack obrigatória de monorepo. A máquina já tinha pnpm 11.1.3 e Node 22 LTS.

**Decisão.** Workspace com `apps/*` e `packages/*`. Turborepo orquestra `build`, `typecheck`, `test` e `test:coverage`. O `lint` roda uma única vez na raiz, com ESLint flat config compartilhado, porque as regras são idênticas em todos os pacotes e uma execução evita configuração duplicada.

**Consequências.** Cache de tarefas por pacote. Scripts de instalação ficam bloqueados por padrão (`allowBuilds` em `pnpm-workspace.yaml`), atendendo `PRD.md` §13.7 — cada exceção é explícita e auditável.

---

## ADR-0002 — TypeScript 5.9 em vez de 7.x

**Status:** Aceita · Fase 1 · revisar na Fase 14

**Contexto.** A versão mais recente do TypeScript no momento da implementação era a 7.0.2. O NestJS depende de `emitDecoratorMetadata` para resolver dependências por tipo, recurso cuja paridade no compilador nativo ainda não está garantida.

**Decisão.** Fixar `typescript@^5.9.3` em todos os pacotes, com `strict` e os complementos `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns` e `noUnusedLocals`/`noUnusedParameters`.

**Consequências.** Estabilidade de build. `PRD.md` §12.1 pede versões estáveis e compatíveis, não a mais recente. A migração para o TS 7 será reavaliada na Fase 14, quando a API já tiver cobertura de integração suficiente para detectar regressões de DI.

---

## ADR-0003 — Repositório em memória na Fase 1, Prisma na Fase 2

**Status:** Provisória · Fase 1

**Contexto.** A primeira fatia funcional precisava atravessar web → API → domínio de ponta a ponta, mas o Docker não está instalado nesta máquina e `PRD.md` §12.1 exige PostgreSQL como banco transacional.

**Decisão.** Definir a porta `ApplicationRepository` (`apps/api/src/applications/application.repository.ts`) e atendê-la, nesta fase, com `InMemoryApplicationRepository`. A troca pelo adapter Prisma acontece em uma única linha de `provide` no `ApplicationsModule`.

**Consequências.** A fatia é demonstrável sem infraestrutura. O estado se perde a cada reinício — aceitável para a demonstração da Fase 1 e **inadequado para qualquer outro uso**. Nenhum invariante de banco de `PRD.md` §11.1 está garantido até a Fase 2.

---

## ADR-0004 — Zod como fonte única de validação

**Status:** Aceita · Fase 1

**Contexto.** `PRD.md` §12.1 admite "Zod ou DTOs validados do NestJS", exigindo schemas compartilhados entre camadas.

**Decisão.** Concentrar os contratos em `packages/schemas`. A API aplica os schemas no limite via `ZodValidationPipe`; a web usa os mesmos schemas para validação imediata no cliente e para validar a resposta recebida.

**Consequências.** Uma regra, um lugar. Divergência de contrato falha no cliente antes de renderizar dado inválido. A validação no navegador é conveniência, nunca controle de segurança — o controle permanece no servidor (`PRD.md` §13.5).

---

## ADR-0005 — Pilha de fontes do sistema na Fase 1

**Status:** Provisória · Fase 1 · resolver na Fase 14

**Contexto.** O `/docs/DESIGN.md` indica SF Pro e sugere **Inter** (Google Fonts) como substituto em plataformas não Apple. `PRD.md` §13.5 exige CSP restritiva e §13.4 evita dependências externas não controladas.

**Decisão.** Usar apenas `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`. Nenhuma requisição a CDN de fontes; a CSP da web não permite origem externa.

**Consequências.** Em macOS/iOS o resultado é o SF Pro real, exatamente como o `DESIGN.md` descreve. Em outras plataformas a renderização usa a fonte do sistema, com pequena diferença de tracking. A auto-hospedagem do Inter (com os ajustes de `letter-spacing` e `line-height` que o `DESIGN.md` especifica) fica para a Fase 14.

---

## ADR-0006 — Estados de formulário provisórios

**Status:** Provisória · Fase 1 · **requer validação do time de design**

**Contexto.** Conflito documentado. O `/docs/DESIGN.md` registra em _Known Gaps_: "Form validation and error states were not surfaced on the analyzed pages". O `PRD.md` §17 e §20 exigem validação inline, resumo de erros e estados de loading/vazio/erro/sucesso.

**Decisão.** Conforme a instrução de `PRD.md` §1.1 para documento de design incompleto, foi criada uma camada **mínima e provisória**, derivada exclusivamente de tokens já existentes:

- borda de 2px em `{colors.primary-focus}` no campo inválido;
- mensagem em `{typography.caption}` com `{colors.ink}`, precedida do prefixo textual "Erro:" para leitores de tela;
- resumo de erros em `{colors.surface-pearl}` com a mesma borda;
- `aria-invalid`, `aria-describedby` e foco programático no resumo.

Nenhuma cor semântica nova (verde/vermelho/amarelo) foi introduzida na marca.

**Consequências.** O requisito funcional e de acessibilidade é atendido sem criar um design system paralelo. `PRD.md` §17 exige que o status não dependa apenas de cor — daí o prefixo textual e a mudança de espessura de borda. Se a Prefeitura definir uma paleta semântica oficial, esta camada deve ser substituída.

---

## ADR-0007 — Política de grupamento etário como dado versionado

**Status:** Provisória · Fase 1 · **pendente de confirmação da SME**

**Contexto.** `PRD.md` §8.1 exige que o grupamento seja calculado por "função de domínio testável e parametrizada". `PRD.md` §21 mantém em aberto a confirmação das regras oficiais por processo, e §1.2 proíbe apresentar dado de demonstração como retrato oficial.

**Decisão.** O grupamento é resolvido por `resolveAgeGroup(...)`, função pura que recebe a política como **dado**. A política embarcada `DEMO_AGE_GROUP_POLICY_2026` carrega `status: 'DEMONSTRACAO'`, `version`, `referenceDate` e um campo `source` declarando a origem. Faixas usadas na demonstração: Berçário I 6–11 meses, Berçário II 12–23, Maternal I 24–35, Maternal II 36–47, com data de corte 31/03/2026.

O status da regra é propagado até a interface e exibido junto ao resultado.

**Consequências.** Nenhum número oficial foi inventado no código. Publicar a regra oficial significa adicionar uma nova política com `status: 'OFICIAL'` — sem tocar no algoritmo e sem reescrever resultados históricos, como `PRD.md` §8.7 determina.

---

## ADR-0008 — Área de proteção clara para o logotipo na navegação azul

**Status:** Provisória · Fase 1 · **TODO: solicitar variante negativa**

**Contexto.** Conflito documentado. O `/docs/DESIGN.md` especifica `{component.global-nav}` com fundo `{colors.surface-tile-1}` (#13335a) e manda usar "a variante indicada para fundo azul". O diretório `/img/logo` contém apenas duas variantes, ambas para fundo claro:

- `RIOPREFEITURA Educação horizontal monocromática preto.png`
- `RIO PREFEITURA Educação vertical monocromática azul.png`

O `DESIGN.md` também determina: "Se a variante necessária não existir, registre um `TODO` explícito e não invente uma nova versão", e proíbe recolorir, mascarar ou aplicar efeitos.

**Decisão.** A navegação mantém o fundo azul institucional exigido e apresenta o ativo **horizontal monocromático preto, sem qualquer alteração**, sobre uma área de proteção clara (`{colors.canvas}`, raio `{rounded.sm}`). O rodapé, cujo fundo é `{colors.canvas-parchment}`, usa a variante vertical azul diretamente.

**TODO.** Solicitar à Prefeitura do Rio a variante negativa/branca para fundo azul. Ao recebê-la, substituir a área de proteção pelo uso direto do ativo.

**Consequências.** Nenhuma variante foi inventada e nenhum arquivo oficial foi modificado. A área de proteção é um recurso de layout, não uma alteração da marca. Os logotipos são servidos de `/img/logo` na raiz pública, com os nomes originais preservados.

---

## ADR-0009 — `@match/ui` consumido por `transpilePackages`

**Status:** Aceita · Fase 1

**Contexto.** `packages/ui` entrega componentes React e folhas CSS. Publicá-lo compilado exigiria um passo de build com cópia de assets e complicaria a resolução de CSS dentro de `node_modules`.

**Decisão.** O pacote expõe o código-fonte (`main: ./src/index.ts`) e o Next o processa via `transpilePackages`. Seu `build` é intencionalmente um no-op; o `typecheck` roda `tsc --noEmit`.

**Consequências.** CSS e componentes resolvem sem etapa intermediária. O pacote é consumível apenas por bundlers — o que é adequado, já que a API nunca importa UI.

---

## ADR-0010 — CSP com `'unsafe-inline'` em `style-src` e `script-src`

**Status:** Provisória · Fase 1 · endurecer na Fase 14

**Contexto.** `PRD.md` §13.5 exige CSP configurada. O Next injeta estilos e scripts de bootstrap inline; uma CSP baseada em nonce exige middleware por requisição e desabilita a renderização estática de algumas rotas.

**Decisão.** A web publica CSP sem nenhuma origem externa (`default-src 'self'`, `img-src 'self' data:`, `connect-src 'self' <API>`, `object-src 'none'`, `frame-ancestors 'none'`), aceitando `'unsafe-inline'` apenas em `script-src` e `style-src`. A API, que responde só JSON, usa a CSP máxima `default-src 'none'`.

**Consequências.** Nenhum recurso de terceiros pode ser carregado — o que também reforça a proibição do `DESIGN.md` de baixar logotipos externos em tempo de execução. A eliminação do `'unsafe-inline'` via nonce está prevista na Fase 14.

---

## ADR-0011 — Build da API por `tsc` em vez do `@nestjs/cli`

**Status:** Aceita · Fase 1

**Contexto.** `nest build` falhou com `ERR_REQUIRE_CYCLE_MODULE` ao carregar `ora` através de `@angular-devkit/schematics`, uma incompatibilidade entre o `@nestjs/cli` 12 e o Node.js 22 neste ambiente.

**Decisão.** Remover o `@nestjs/cli`. O build usa `tsc -p tsconfig.build.json` diretamente; o modo de desenvolvimento usa `concurrently` com `tsc --watch` e `node --watch dist/main.js`. Para os testes, o Vitest transforma o código com `unplugin-swc`, porque o esbuild não emite `design:paramtypes` e a injeção de dependências do Nest depende desse metadado.

**Consequências.** Menos dependências no caminho de build e uma cadeia de ferramentas mais previsível. Schematics do Nest (`nest generate`) deixam de estar disponíveis — irrelevante, já que os arquivos são escritos manualmente.

---

## ADR-0012 — Grupamento derivado na leitura, não persistido

**Status:** Aceita · Fase 1

**Contexto.** `PRD.md` §8.1 exige que alterar o nascimento **ou** a data de referência recalcule o grupamento.

**Decisão.** O repositório guarda apenas as entradas (mês/ano de nascimento, processo, turno, data de referência opcional). O grupamento é calculado a cada leitura, a partir da política do processo.

**Consequências.** É impossível existir um grupamento derivado desatualizado. Quando os volumes de `PRD.md` §15.2 entrarem em cena, o resultado do motor de pontuação (`ScoreResult`, `PRD.md` §11) continuará sendo materializado — o que se recalcula aqui é apenas uma função pura e barata sobre dados já carregados.

---

## Decisões deliberadamente **não** tomadas

Registradas para que nenhuma fase futura as feche por inércia. Todas constam de `PRD.md` §21.

| Tema                                            | Situação                                                                                                                                                      |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Biblioteca de mapas (MapLibre vs. Leaflet)      | `PRD.md` §12.1 delega ao `/docs/DESIGN.md`, que não trata de mapas. **Em aberto** até a Fase 13; a UI será isolada atrás de um componente para permitir troca |
| Provider de geocodificação e cache de CEP       | **Em aberto**. A Fase 4 entrega uma porta com mock determinístico                                                                                             |
| Distância geodésica vs. rota viária em produção | **Em aberto**. Haversine rotulada como estimativa, conforme `PRD.md` §8.5                                                                                     |
| Identidade oficial para famílias e operadores   | **Em aberto**. Auth simulada e claramente identificada na Fase 10                                                                                             |
| PostGIS                                         | **Em aberto**. `PRD.md` §15.4 condiciona a "se disponível"; avaliar na Fase 13                                                                                |
| Base legal, consentimentos e retenção           | **Fora do MVP**. `PRD.md` §13.1 exige validação pelo encarregado de dados e pelas áreas jurídica e de segurança da SME                                        |
| RPO, RTO e infraestrutura de produção           | **Fora do MVP**. `PRD.md` §15.6 proíbe assumir valores                                                                                                        |

---

## ADR-0013 — Adapter PostgreSQL/Prisma substitui o repositório em memória

**Status:** Aceita · Fase 2 · substitui a parte provisória do ADR-0003

**Contexto.** O ADR-0003 previa a troca assim que houvesse banco disponível. A máquina não tem Docker, mas já roda **PostgreSQL 16.13 via Homebrew** na porta 5432, o que destravou a fase sem instalar nada.

**Decisão.** `PrismaApplicationRepository` passa a atender a porta `ApplicationRepository`. O `InMemoryApplicationRepository` foi **removido**, não mantido em paralelo: uma segunda implementação que nenhum teste exercita é código morto, e `PRD.md` §14.3 exige explicitamente "API com PostgreSQL real".

A porta ganhou `WriteContext` (correlation ID, ator, papel) para que a persistência não precise adivinhar quem originou a operação, conforme `PRD.md` §8.16.

**Consequências.** A API deixa de subir sem banco — `DATABASE_URL` passou a ser obrigatória e validada na inicialização. Isso é intencional: falhar no boot é melhor do que falhar na primeira escrita. Toda escrita é transacional (`PRD.md` §15.6): inscrição, evento de status e evento de auditoria entram juntos ou não entram.

---

## ADR-0014 — A regra de grupamento passa a vir de `RuleVersion`

**Status:** Aceita · Fase 2 · evolui o ADR-0007

**Contexto.** Na Fase 1 a política de grupamento era a constante `DEMO_AGE_GROUP_POLICY_2026` no domínio. `PRD.md` §8.7 exige que alterar uma regra crie uma nova versão sem reescrever resultado histórico — o que uma constante de código não consegue garantir.

**Decisão.** A política agora vive em `RuleVersion`, com `version`, `status`, `effectiveFrom`, `source` e um `payload` JSON. `RuleVersionService` carrega a versão vigente e **revalida o payload com Zod a cada leitura**; regra malformada falha de forma explícita em vez de produzir resultado silenciosamente errado.

A constante permanece no domínio como **fonte do seed e fixture de teste**, não mais como caminho de execução.

**Consequências.** O banco passa a ser a autoridade sobre qual regra estava vigente, que é a precondição para reconstruir uma pontuação histórica. O `ageGroup.policy.id` exposto na API deixou de ser um slug e passou a ser o UUID da versão de regra — identidade real, rastreável até a linha.

---

## ADR-0015 — Append-only imposto por trigger, não por convenção

**Status:** Aceita · Fase 2

**Contexto.** `PRD.md` §13.8 exige que a auditoria seja append-only e que "acesso de administrador não elimine rastreabilidade". Disciplina de aplicação não cumpre isso: um bug, um script ad hoc ou um usuário com privilégio elevado apagariam a trilha.

**Decisão.** A função `match_append_only_guard()` bloqueia `UPDATE` e `DELETE` em `AuditEvent` e em `StatusEvent`. `StatusEvent` recebe a mesma proteção por ser, por definição, um histórico temporal — reescrever o passado invalidaria o cálculo de tempo até resposta de `PRD.md` §18.3.

A primeira versão usava `ERRCODE = 'restrict_violation'` (SQLSTATE 23001). O Prisma traduz **toda** a classe 23 para "Foreign key constraint violated" e descarta a mensagem original, escondendo a causa real. Uma migration subsequente removeu o `ERRCODE`, deixando o padrão `P0001`, que o Prisma repassa intacto.

**Consequências.** A garantia vale para qualquer cliente do banco, não só para a API. `TRUNCATE` continua permitido — os triggers são `FOR EACH ROW` sobre `UPDATE`/`DELETE` — o que é deliberado: a suíte de testes precisa de um ponto de partida limpo, e `TRUNCATE` exige privilégio de owner.

---

## ADR-0016 — Prisma dentro de `packages/database`, não em `prisma/` na raiz

**Status:** Aceita · Fase 2 · desvia de `PRD.md` §12.2

**Contexto.** `PRD.md` §12.2 sugere `prisma/` na raiz do repositório. Sob pnpm workspaces o cliente gerado é resolvido por pacote, então um schema na raiz sem um pacote dono torna a resolução do cliente frágil entre API, worker (Fase 11) e pipeline (Fase 3).

**Decisão.** Schema, migrations, seed e cliente vivem em `packages/database`, exportados como `@match/database`. A estrutura de `PRD.md` §12.2 é declarada "sugerida", e este é o ponto em que segui-la literalmente prejudicaria a fase seguinte.

O Prisma 7 removeu `url` do `schema.prisma`: a conexão vem de `prisma.config.ts` (Migrate) e do driver adapter `@prisma/adapter-pg` (execução), ambos lendo do ambiente. Nenhuma credencial no repositório.

**Consequências.** Um único dono do schema para todos os consumidores futuros. O Prisma 7 também deixou de carregar `.env` automaticamente, então API e seed usam `--env-file-if-exists` e `process.loadEnvFile`, sem adicionar dependência de dotenv.

**Nota sobre rollback.** O Prisma Migrate não gera migrations de reversão. A estratégia é _forward-fix_: um problema em produção é corrigido por uma migration nova, nunca por edição de uma já aplicada — como foi feito com o `ERRCODE` acima. `PRD.md` §14.3 pede rollback "quando suportado"; aqui não é.
