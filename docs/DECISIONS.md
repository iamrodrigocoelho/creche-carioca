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

**Status:** Encerrada pelo ADR-0031 · era Provisória · Fase 1

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

---

## ADR-0017 — Variáveis de banco declaradas em `globalEnv` do Turbo

**Status:** Aceita · Fase 2

**Contexto.** O Turbo 2 opera com `envMode: strict` por padrão: uma tarefa só recebe as variáveis de ambiente declaradas em `turbo.json`. Com apenas `NODE_ENV` declarada, `DATABASE_URL_TEST` não chegava ao Vitest.

O sintoma era enganoso. O `globalSetup` do Vitest lançava por falta da variável, mas o Vitest engole erros de `globalSetup` e reporta apenas **"No test files found"**. Pior: o problema não aparecia em desenvolvimento, porque `loadTestEnv` carrega o `.env` da raiz e supre as variáveis independentemente do Turbo. Só quebrou no CI, onde não existe `.env`.

**Decisão.** Declarar `DATABASE_URL` e `DATABASE_URL_TEST` em `globalEnv`. Além disso, `loadTestEnv` passou a escrever a causa em `stderr` **antes** de lançar, para que o diagnóstico apareça mesmo quando o Vitest mascara a exceção.

**Consequências.** A URL do banco passa a integrar a chave de cache do Turbo — trocar de banco invalida o cache, o que é correto, já que o resultado dos testes depende dele. Qualquer variável de ambiente nova que uma tarefa precise deve ser declarada aqui; caso contrário ela silenciosamente não chega.

---

## ADR-0018 — Código de unidade reancorado por largura

**Status:** Aceita · Fase 3

**Contexto.** O `esc_codigo` chega com larguras diferentes conforme a fonte. A Query A grava 5 dígitos para creches parceiras e 7 para unidades públicas. Já `Unidades_Unificadas_com_Localizacao.xlsx` passou por uma planilha que guardou o código como número e comeu os zeros à esquerda: ali aparecem larguras de 4 a 7. Comparar as strings cruas casa apenas 150 das 872 unidades citadas nas inscrições.

**Decisão.** Normalizar por largura antes de qualquer junção: até 5 dígitos, preencher com zeros à esquerda até 5; de 6 a 7, até 7. Valores não numéricos ou com mais de 7 dígitos viram `null` em vez de serem adivinhados.

A regra recupera 852 das 872 unidades, sem nenhuma colisão — nenhum código normalizado casa com duas unidades distintas. As 20 restantes simplesmente não estão no arquivo de localização, e viram o achado `unidade_sem_localizacao`.

**Consequências.** A largura vira parte do contrato: se a SME publicar códigos de 6 dígitos para parceiras, a regra passa a ancorar errado. Por isso a checagem de unicidade de chave bloqueia a publicação — uma mudança de padrão apareceria como colisão, não como dado silenciosamente errado.

---

## ADR-0019 — `Unidades_Unificadas_com_Localizacao.xlsx` como fonte de geografia

**Status:** Aceita · Fase 3

**Contexto.** O plano previa que a Fase 3 normalizasse "unidades, coordenadas, CRE e microárea". Os quatro arquivos da pasta `Bases IC_ ClassificadoseFila/` não têm nada disso: o catálogo de unidades traz logradouro, número, bairro e CEP, e para 258 das 2.188 unidades nem isso. Não há latitude, longitude nem CRE em lugar nenhum daquele diretório.

Chegou-se a considerar geocodificar por CEP contra um serviço externo. A alternativa apareceu em outro diretório do mesmo repositório de dados: `OferecimentosEvagas/Unidades_Unificadas_com_Localizacao.xlsx`, com `LATITUDE`, `LONGITUDE`, `CRE` e `microárea` preenchidos nas 1.941 linhas.

**Decisão.** Usar essa planilha como fonte canônica de geografia, cruzada por `esc_codigo` normalizado (ADR-0018). Nenhuma geocodificação externa entra no pipeline.

O catálogo de endereços é o lado esquerdo da junção, porque cobre 872/872 dos códigos vistos nas inscrições enquanto a planilha cobre 852.

**Consequências.** Sem dependência de rede nem de serviço de terceiros para posicionar unidades, e a CRE vem do dado oficial em vez de ser inferida do bairro. Em troca, 20 unidades citadas nas inscrições ficam sem coordenada; a Fase 8 precisa decidir o que fazer com elas na alocação por distância, e o relatório de qualidade as lista nominalmente.

O shapefile das microáreas vem em EPSG:31983 (SIRGAS 2000 / UTM 23S) e é reprojetado para WGS84 na ingestão, para ficar no mesmo referencial das coordenadas da planilha.

---

## ADR-0020 — Desduplicação determinística do catálogo de unidades

**Status:** Aceita · Fase 3

**Contexto.** O dicionário de dados da origem apresenta `esc_codigo` como a chave que junta o catálogo de unidades com as inscrições, e de fato ela cobre 872/872. Mas ela **não é única**: 78 códigos aparecem em mais de uma linha, e 74 desses grupos divergem em nome ou endereço.

São dois fenômenos diferentes sob o mesmo sintoma. Um é cosmético — a mesma unidade grafada de dois jeitos, uma linha com endereço e outra sem (`0101001`: "EM VICENTE LICINIO CARDOSO" e "ESCOLA MUNICIPAL VICENTE LICÍNIO CARDOSO"). O outro não é: entre as creches parceiras há códigos reaproveitados por instituições distintas (`01001`: "Instituto Central do Povo" e "Associação de Educação Infantil Florescer"). 40 desses códigos aparecem nas inscrições.

Deixar como estava faria a junção multiplicar linhas silenciosamente — uma inscrição passaria a casar com duas unidades.

**Decisão.** `cur_unidades` tem exatamente uma linha por código. Vence a linha com endereço preenchido; no empate, o menor `seq_interno`. As linhas descartadas vão para `cur_unidades_descartadas` e aparecem no relatório como `codigo_de_unidade_reaproveitado`.

Além disso, três portões rodam antes de escrever qualquer Parquet: contagem da origem contra o dicionário, unicidade das chaves, e reconciliação do catálogo — toda linha da origem tem de terminar publicada, descartada por duplicidade, ou registrada como sem código. Se a soma não fecha, a publicação falha.

**Consequências.** O critério de desempate é uma escolha nossa, não um fato da origem: para os códigos genuinamente reaproveitados, uma instituição real fica de fora das tabelas curadas. Isso é registrado, não resolvido — resolver exigiria uma chave que os dados não têm. A Fase 6, ao recomendar unidades, herda essa limitação.

A reconciliação já pagou por si: revelou 24 unidades com `esc_codigo` gravado como `NULL` que estavam sendo descartadas sem aparecer em lugar nenhum.

---

## ADR-0021 — Normalização escrita duas vezes, com teste de paridade

**Status:** Aceita · Fase 3

**Contexto.** As bases têm 837 mil e 4,3 milhões de linhas. Normalizar em TypeScript exigiria trazer cada linha para o Node, o que PRD §10.3 proíbe explicitamente. Normalizar só em SQL deixaria as regras sem teste unitário e não permitiria reutilizá-las na API.

**Decisão.** Cada regra existe nas duas formas: uma função pura em `normalize.ts` e uma expressão SQL em `sources.ts`. A ingestão usa a versão SQL, dentro do DuckDB. Um teste roda as duas sobre as mesmas entradas, incluindo os casos de borda, e falha se divergirem.

**Consequências.** Duplicação deliberada, com o risco de divergência coberto por teste em vez de por disciplina. Toda regra nova precisa nascer nas duas formas — o teste de paridade não detecta uma regra que exista só de um lado, apenas uma que exista dos dois e discorde.

---

## ADR-0022 — Publicação versionada, sem sobrescrita

**Status:** Aceita · Fase 3

**Contexto.** PRD §10.3 exige não substituir silenciosamente arquivos ou versões já importadas, e registrar origem, hash, data e versão de cada importação.

**Decisão.** Cada execução escreve em `data/curated/<versao>/`, com a versão derivada do instante em UTC. Se o diretório existir, o pipeline falha em vez de sobrescrever. Junto dos Parquet vão `manifest.json` (SHA-256 e tamanho de cada arquivo de origem) e `relatorio-qualidade.json`.

Não há ponteiro para "última importação". Um arquivo `latest` mutável seria exatamente a sobrescrita silenciosa que o critério proíbe; quem consome ordena os diretórios.

**Consequências.** Reimportar exige escolher uma versão nova ou apagar a antiga conscientemente, e o diretório cresce a cada execução — não há política de retenção, que fica para a Fase 14. Em troca, qualquer resultado analítico pode ser rastreado até os bytes exatos que o produziram.

---

## ADR-0023 — Geocodificação ancorada no setor de CEP das unidades reais

**Status:** Aceita · Fase 4

**Contexto.** PRD §21 deixa o provider de geocodificação em aberto (B-03) e o plano previa um "mock determinístico". O caminho mais curto seria derivar latitude e longitude de um hash do CEP, dentro da caixa do município: zero dependências e determinístico.

O problema é o que vem depois. A Fase 6 ordena unidades por distância e a Fase 8 aloca vagas usando essa ordem. Com coordenadas de hash, as distâncias são ruído com aparência de informação — a recomendação ficaria impossível de avaliar, e um erro de ordenação seria indistinguível do acaso.

A Fase 3 deixou disponível o que faltava: 1.913 unidades escolares com CEP e coordenada conhecidos.

**Decisão.** O adapter resolve pelo **setor do CEP** — os cinco primeiros dígitos. Para cada setor onde há ao menos uma unidade com coordenada, a referência guarda o centroide dessas unidades e o bairro predominante. São 353 setores num artefato de 47 KB, gerado pelo pipeline e versionado em `apps/api/src/geocoding/cep-sectors.json`.

A cobertura foi medida contra os CEPs reais das famílias nos cinco processos: **19.376 dos 21.688 CEPs distintos**, ou 89%. O casamento exato de CEP cobriria só 6%, o que descartou a alternativa mais óbvia.

**Consequências.** As distâncias da Fase 6 passam a ter significado geográfico, e o mesmo CEP devolve sempre o mesmo ponto — a recomendação é reproduzível.

Os 11% que não resolvem **são a parte boa**: PRD §8.2 exige que a família consiga escolher unidades por bairro quando a geocodificação falha, e com um mock que sempre resolve esse caminho nasceria como código morto, nunca exercitado.

O artefato é versionado porque o CI não tem os datasets. Ele precisa ser regerado quando a base de unidades mudar, com `pnpm --filter @match/data-pipeline cep-reference` — um passo manual, como as fixtures.

Nada disso escolhe um provider de produção. B-03 continua aberto, e a troca é uma linha em `GeocodingModule`.

---

## ADR-0024 — A incerteza viaja junto da coordenada

**Status:** Aceita · Fase 4

**Contexto.** Um setor de CEP não é um ponto. Medindo a dispersão das unidades dentro de cada setor, o raio mediano é de 750 m, o percentil 90 é de 2,6 km e o pior caso chega a 10,7 km — setores da Barra e do Recreio cobrem áreas enormes. Devolver uma latitude e uma longitude sem mais nada faria uma estimativa de vários quilômetros parecer um endereço.

Havia ainda uma armadilha: 55 setores têm uma única unidade de referência. O raio medido neles é exatamente zero — um ponto não tem dispersão — e publicar isso significaria **afirmar precisão perfeita justamente onde a evidência é mais fraca**.

**Decisão.** `GeocodeResolved` carrega `precisionKm` obrigatório, propagado até o banco (onde um check constraint impede `RESOLVIDO` sem incerteza) e até a interface, que escreve "posição aproximada, com margem de cerca de 800 metros".

Para setores de uma única unidade, a incerteza atribuída é o percentil 90 dos setores com mais de uma — derivado dos próprios dados, não arbitrado. Um piso de 500 m se aplica a todos, porque o centroide aproxima o setor, nunca o endereço da família.

O artefato guarda apenas fatos — centroide, raio medido, contagem de unidades. A política de precisão vive no código, onde é testável.

**Consequências.** A interface pode ser honesta sobre o que sabe, o que PRD §8.5 já exigia para distâncias. A Fase 6 recebe a informação necessária para decidir se ordenar por uma estimativa dessa granularidade é defensável — e, se não for, para dizê-lo.

---

## ADR-0025 — `normalizeCep` no domínio

**Status:** Aceita · Fase 4

**Contexto.** O pipeline da Fase 3 normalizava CEP ao ingerir as bases históricas. A Fase 4 precisa da mesma normalização ao validar o que a família digita. As duas fronteiras não podem depender uma da outra: `@match/data-pipeline` carrega o DuckDB, e a API não tem por que carregá-lo.

Reimplementar era o caminho fácil e o errado: bastaria uma divergência de uma linha para o mesmo CEP virar duas chaves diferentes entre a ingestão e a inscrição, e o sintoma apareceria lá na frente, como uma unidade que não casa com o bairro da família.

**Decisão.** A regra vive em `@match/domain`, que já é o pacote de regras puras sem I/O. O pipeline reexporta; o schema Zod da API usa a mesma função dentro de um `transform`, de modo que `20931-004` e `20931004` chegam idênticos ao serviço e a comparação de duplicidade não depende da forma digitada.

**Consequências.** Uma definição só de "o que é um CEP" em todo o sistema. O teste de paridade SQL×TypeScript do pipeline (ADR-0021) continua valendo e agora protege também a API.

---

## ADR-0026 — CEP duplicado é sinalizado, não recusado

**Status:** Aceita · Fase 4

**Contexto.** PRD §8.2 diz que "CEPs duplicados na mesma inscrição devem ser sinalizados". A leitura preguiçosa seria tratar como erro de validação e recusar.

Mas repetir um CEP é uma situação real e legítima: quem trabalha em casa tem residência e trabalho no mesmo endereço; quem mora com a avó que ajuda com a criança tem residência e rede de apoio no mesmo lugar. Recusar obrigaria a família a mentir ou a desistir do segundo ponto.

**Decisão.** A duplicidade é calculada na leitura e devolvida como `duplicateOfPosition`, apontando para a primeira ocorrência. A interface avisa e segue: "Este CEP é igual ao do ponto 1. Pode continuar assim, se for o caso."

**Consequências.** A família fica informada sem ser bloqueada — que é o que "sinalizar" quer dizer. A Fase 6, ao ordenar unidades por proximidade a cada ponto, precisa saber que dois pontos podem coincidir, para não apresentar a mesma distância duas vezes como se fossem evidências independentes.

---

## ADR-0027 — Índice cego agora, cifragem depois

**Status:** Aceita · Fase 5

**Contexto.** PRD §13.4 pede criptografar em nível de aplicação os valores completos de telefone e perfis sociais "quando viável". O plano marcava a avaliação para esta fase.

Cifrar de verdade traria junto o que a cifragem sempre traz: uma chave que precisa existir em desenvolvimento, no CI e em produção, um caminho de rotação, e a perda da capacidade de comparar valores — e comparar é necessário, porque PRD §8.3 exige sinalizar telefone duplicado.

**Decisão.** Nesta fase entra apenas o **índice cego**: um HMAC-SHA256 do valor normalizado, gravado ao lado do valor. A duplicidade é detectada comparando índices, nunca valores. O valor completo continua em texto no banco, apoiado na criptografia em repouso que PRD §13.4 já exige em produção.

O índice é um HMAC, e não um SHA-256 simples, e isso não é preciosismo. O espaço de telefones brasileiros tem menos de 10¹¹ combinações: uma tabela de todos os hashes possíveis se constrói em minutos num laptop. Sem segredo, o "índice cego" seria uma tradução reversível do número — pior que inútil, porque pareceria proteção.

**Consequências.** Duas honestas, e vale nomeá-las.

A primeira: **isto não protege o telefone hoje.** Quem tiver acesso ao banco lê os números. O que o índice entrega é estrutura — quando a cifragem chegar na Fase 14, o índice já estará calculado e correto, e nenhum dado precisará ser migrado. Foi essa a razão de fazer metade agora em vez de nada.

A segunda: `CONTACT_FINGERPRINT_KEY` **não tem rotação**. Trocar a chave invalida todos os índices gravados, e a detecção de duplicidade para de funcionar para os contatos antigos até serem reescritos. A variável não tem valor padrão de propósito — uma chave embutida no código seria pública, e um índice com chave pública não esconde nada.

O canal entra no cálculo (`TELEFONE:`, `SOCIAL:INSTAGRAM:`) para que o mesmo texto em contextos diferentes nunca colida, e para que o mesmo `@handle` em duas redes não seja lido como duplicata.

---

## ADR-0028 — `ContactPoint` unificado por canal

**Status:** Aceita · Fase 5

**Contexto.** Telefone e perfil social têm campos quase disjuntos: um tem E.164 e consentimentos de ligação, SMS e WhatsApp; o outro tem plataforma, `@handle` e autorização de contato. Tabelas separadas pareceriam mais limpas.

**Decisão.** Uma tabela só, discriminada por `channel`, como PRD §11 já previa ao descrever `ContactPoint` como "telefone, e-mail ou perfil social".

A razão é que **as regras que importam são sobre o conjunto**, não sobre cada tipo: exatamente um principal, nunca ficar sem telefone, rede social nunca como único contato. Com tabelas separadas, cada uma dessas regras viraria uma consulta em duas fontes e uma decisão fora do banco. O índice único parcial que garante "no máximo um principal por inscrição" simplesmente não existiria.

Os campos que não se aplicam ficam nulos, e check constraints impedem as combinações sem sentido: telefone com plataforma preenchida, social com E.164, principal que não é telefone.

**Consequências.** A tabela tem colunas nulas por construção, o que é o custo previsível da escolha. Em troca, "quantos contatos alcançáveis esta inscrição tem" é uma consulta, e as invariantes vivem onde podem ser garantidas.

Os endpoints continuam separados (`/contacts/phones` e `/contacts/social`) porque os campos obrigatórios diferem: um schema único com metade dos campos opcionais aceitaria combinações que o banco depois recusaria.

---

## ADR-0029 — Painel do gestor antecipado sobre dados sintéticos

**Status:** Aceita · Antecipação da Fase 10

**Contexto.** O painel do gestor (RF-10) pertence à Fase 10 e depende da Fase 6: "creches mais procuradas" e "fila de espera por creche" exigem `Unit` e `Preference` no schema canônico, e nenhum dos dois existe. As unidades só vivem na camada curada em Parquet da Fase 3, e a escolha de creche pela família ainda não foi implementada.

A demonstração para o gestor, porém, é necessária antes disso: é ela que valida se as perguntas que o painel responde são as perguntas que o gestor faz. Construir a Fase 6 inteira só para descobrir que a leitura útil era outra é a ordem errada.

**Decisão.** O painel é entregue agora, sobre um conjunto sintético declarado (`apps/web/src/lib/dashboard/demo-data.ts`), com três separações deliberadas:

- As **derivações** (`metrics.ts`) são funções puras sobre `DemandRow[]` e não sabem de onde os dados vêm. Quando a Fase 6 trouxer as tabelas reais, muda a origem do snapshot; a interface e os testes continuam.
- Os **tipos** (`types.ts`) já têm o formato que a consulta real vai devolver, incluindo a distinção entre turno de oferta (`INTEGRAL`/`PARCIAL`) e turno desejado pela família (que admite `AMBOS`).
- O conjunto é **determinístico**, gerado por semente fixa: a apresentação é reproduzível e uma alteração acidental quebra o teste de estabilidade em vez de passar despercebida.

Nomes de unidade são fictícios, na convenção da rede. Atribuir fila fabricada a uma escola real é exatamente a confusão que PRD §1.2 proíbe; os bairros são reais apenas para dar escala geográfica.

**Consequências.** O painel existe e é discutível com o gestor, mas **não tem** o que a Fase 10 exige: não há RBAC, escopo territorial por CRE nem auditoria de exportação — qualquer perfil vê a rede inteira. Isso está declarado na própria página. A Fase 10 permanece necessária e agora entra com a interface já validada, reduzida ao trabalho de backend: consulta real, autorização por objeto e território, e os testes negativos de vazamento entre CREs.

---

## ADR-0030 — Pressão medida pela primeira opção, sem semáforo de cor

**Status:** Aceita · Antecipação da Fase 10

**Contexto.** "Creche mais procurada" isolada é um número que engana: uma unidade com 300 inscrições e 200 vagas está melhor que uma com 80 e 12. O indicador que decide é a razão candidato/vaga — e ela pode ser calculada de duas formas, com resultados muito diferentes. Cada inscrição cita até cinco unidades (PRD §8.6); somar todas as citações infla o indicador e faz toda unidade parecer crítica.

Havia ainda a questão de como mostrar severidade: o `DESIGN.md` registra em "Known Gaps" que estados de severidade não foram formalizados, e não existe token vermelho ou âmbar na paleta.

**Decisão.** A razão é medida pela **primeira opção**; a demanda em qualquer opção aparece como coluna separada, para que a diferença fique visível em vez de embutida. A severidade é dita por extenso (Crítica, Alta, Moderada, Equilibrada) e reforçada pelo comprimento da barra, sobre uma rampa de opacidade da mesma cor primária — nenhum vermelho foi inventado. A escala da barra satura em quatro candidatos por vaga: a diferença entre 4 e 6 não muda a decisão do gestor, mas uma barra que nunca enche esconderia a diferença entre 1 e 2, que muda.

**Consequências.** Nenhuma informação do painel depende só de cor (PRD §17) e nenhuma paleta paralela nasce fora do `DESIGN.md`. A "fila" exibida é o excedente da primeira opção sobre as vagas do recorte — uma aproximação declarada na página, não a fila oficial: a alocação real da Fase 8 considera pontuação, desempate e as demais preferências.

---

## ADR-0031 — Marca do programa Creche Carioca a partir de mockups

**Status:** Aceita · encerra o ADR-0008

**Contexto.** O ADR-0008 registrava um TODO: `/img/logo` não tinha variante de logotipo para fundo azul, e a navegação institucional exibia o ativo preto sobre uma área de proteção clara. Chegaram ao diretório dois arquivos novos, `crechecariocaheader.jpeg` e `crechecariocafooter.jpeg`, com a marca do programa — que já embute a assinatura _Prefeitura Rio · Educação_ — em duas composições: placa horizontal e selo circular.

Os dois são **mockups de apresentação**, não ativos de produção. Trazem fundo de textura de papel, traços decorativos nas bordas e, no arquivo de cabeçalho, um xadrez cinza de falsa transparência achatado no JPEG. Usados como estão, o cabeçalho exibiria o xadrez e o rodapé, um retângulo bege sobre `{colors.canvas-parchment}`. O de cabeçalho ainda pesa 1,7 MB para ser exibido a 56px de altura.

**Decisão.** `scripts/build-brand-assets.py` deriva os ativos web a partir dos originais: recorta a silhueta da marca — a placa arredondada e o disco — e torna transparente **apenas o que está fora dela**. O contorno não é inventado: para a placa, ele vem do primeiro e do último pixel azul de cada linha da própria imagem; para o selo, do círculo inscrito no diâmetro medido. Nenhum pixel da marca é tocado: mesmas cores, mesma composição, proporção preservada no redimensionamento.

Isso não é o "recorte" que o `DESIGN.md` proíbe em _Brand Assets_. A proibição protege a marca de ser cortada ou mascarada; aqui o que se remove é o cenário do mockup, que não faz parte dela. Os originais permanecem intactos em `/img/logo` como fonte de verdade.

**Consequências.** A placa tem fundo azul próprio e é legível tanto sobre `{colors.surface-tile-1}` quanto sobre branco, o que **encerra o ADR-0008**: a área de proteção clara deixou de ser necessária e foi removida, junto com o texto "Match Perfeito" que acompanhava o logotipo — a marca agora carrega o nome do programa. Os ativos servidos caem de 1,7 MB para 43 KB (cabeçalho) e de 224 KB para 104 KB (rodapé), a 3× a altura de exibição.

Fica pendente pedir à Prefeitura os ativos vetoriais (SVG) ou PNG com transparência real. A derivação por script é a melhor aproximação possível a partir de um JPEG achatado, e ainda carrega a compressão do original.

---

## ADR-0032 — Correções de contraste e de recolhimento da navegação

**Status:** Aceita

**Contexto.** Uma revisão do que foi implementado contra o `/docs/DESIGN.md` encontrou três desvios, dois deles com efeito direto em acessibilidade:

1. A navegação global não recolhia em ≤ 833px. A _Collapsing Strategy_ pede recolhimento em tablet portrait, e o próprio documento só admite alvo de toque menor que 44px no desktop **porque** assume o menu recolhido no celular. Sem ele, os links ficavam a 12px com cerca de 36px de altura no toque.
2. A linha legal do rodapé usava `{colors.ink-muted-48}` sobre `{colors.canvas-parchment}` a 12px: 4,24:1, abaixo de WCAG AA. O `DESIGN.md` condiciona esse token, em _Texto, divisores e bordas_, a "não usar abaixo de 14px quando não atingir WCAG AA".
3. O anel de `:focus-visible` usava `{colors.primary-focus}` em toda a interface. Sobre `{colors.surface-tile-1}` isso rende 2,11:1 — abaixo dos 3:1 que WCAG 1.4.11 exige de indicadores não textuais. Nos links da navegação e nos botões `--on-dark`, o foco de teclado era praticamente invisível.

**Decisão.** (1) A navegação ganhou botão de menu visível apenas em ≤ 833px, com `aria-expanded`/`aria-controls`; os links viram uma bandeja abaixo da barra, em `{typography.button-utility}` (14px, o token que o documento reserva a rótulos de navegação em botão) e com 44px mínimos de altura. Isso torna `GlobalNav` um componente cliente.

(2) A linha legal passa a `{colors.ink-muted-80}`: 7,92:1 sobre o mesmo fundo.

(3) A cor do foco sai de `--focus-ring`, que aponta para `{colors.primary-focus}` por padrão e é redefinida para `{colors.primary-on-dark}` (5,68:1 contra #13335a) nas superfícies azuis escuras — exatamente o papel que o `DESIGN.md` dá a esse token em _Tokens semânticos_.

**Consequências.** Nenhuma cor nova entrou na paleta: as três correções usam apenas tokens já documentados. `--focus-ring` não é um token de marca, e sim um ponteiro para o token de foco em vigor na superfície atual, o que permite que superfícies escuras futuras herdem o comportamento correto sem repetir a regra.
