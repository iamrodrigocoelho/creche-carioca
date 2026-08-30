# IMPLEMENTATION_PLAN.md — Match Perfeito

**Escopo:** plano de desenvolvimento incremental do MVP descrito em `PRD.md`.
**Fontes de verdade:** `PRD.md` (comportamento, regras, requisitos técnicos) e `/docs/DESIGN.md` (apresentação visual).
**Status:** vivo — atualizado a cada fase concluída.
**Última atualização:** 30/08/2026 (Fase 5 concluída; interface do painel do gestor antecipada — ADR-0029).

> Este documento **não replica** requisitos. Ele referencia os identificadores do PRD (`RF-xx`, seções `§n`) e organiza a ordem de execução. Em qualquer divergência, o `PRD.md` e o `/docs/DESIGN.md` prevalecem.

---

## 1. Inspeção inicial do repositório

| Item                                 | Resultado                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` / `AGENTS.md` / `README` | Não existiam antes da Fase 1                                                                              |
| Instruções adicionais                | Apenas `.claude/settings.local.json` (permissões locais do agente, sem regras de projeto)                 |
| Git                                  | **Não é um repositório Git.** Nenhum commit foi feito (regra de execução)                                 |
| Gerenciador de pacotes               | Nenhum lockfile presente. `pnpm 11.1.3` disponível → adotado (PRD §12.1)                                  |
| Runtime                              | Node.js v22.13.1 (LTS)                                                                                    |
| Docker                               | **Ausente na máquina** (`docker: command not found`) — desnecessário: PostgreSQL 16.13 local via Homebrew |
| Conteúdo pré-existente               | `PRD.md`, `docs/DESIGN.md`, `img/logo/*.png` — todos preservados, nenhum sobrescrito                      |
| Datasets                             | O repositório `CIT-SME-RJ/dadoscreche` (PRD §10.1) **não está** presente localmente                       |

---

## 2. Dependências externas, decisões pendentes e conflitos identificados

### 2.1 Bloqueios externos (não impedem o MVP; tratados por mock/config — PRD §21)

| #    | Item                                                                                                         | Impacto                 | Tratamento adotado                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | ~~Datasets `dadoscreche` não estão no ambiente~~ **resolvido na Fase 3**                                     | Fases 3+ dependem deles | Baixados de `github.com/CIT-SME-RJ/dadoscreche` para `data/raw/`, fora do versionamento. O pipeline lê de `DATA_RAW_DIR` configurável e falha com instrução de download quando os arquivos faltam; as fixtures versionadas cobrem o CI |
| B-02 | ~~Docker ausente~~ **resolvido na Fase 2**                                                                   | PostgreSQL/Redis        | A máquina já roda **PostgreSQL 16.13 via Homebrew**, então a Fase 2 seguiu sem Docker. O `docker-compose.yml` permanece como alternativa equivalente, não executado. O Redis ainda será necessário na Fase 11                          |
| B-03 | Provider de geocodificação indefinido (PRD §21 "Geocodificação") — **contornado na Fase 4**                  | RF-02                   | Porta `GeocodingProvider` com adapter determinístico ancorado no setor de CEP das unidades reais (ADR-0023). Nenhum provider real foi escolhido; a troca fica restrita a uma linha de `provide`                                        |
| B-04 | Distância geodésica vs. rota viária (PRD §21 "Distância")                                                    | RF-05                   | Haversine na porta `DistanceProvider`, rotulada como estimativa (PRD §8.5). Decisão de produção permanece aberta                                                                                                                       |
| B-05 | Identidade oficial / autenticação (PRD §21 "Autenticação")                                                   | RF-10, §13.3            | Auth simulada e explicitamente identificada; RBAC real no backend                                                                                                                                                                      |
| B-06 | APIs sociais e TikTok (PRD §21)                                                                              | RF-04, RF-11            | Todos os adapters sociais permanecem simulados                                                                                                                                                                                         |
| B-07 | Regras oficiais de desempate e de grupamento etário por processo (PRD §21 "Desempates", §14.5 do calendário) | RF-01, RF-07            | Política de grupamento e desempates são **dados versionados e parametrizados**, marcados como `DEMONSTRACAO`. Nenhum valor é tratado como oficial                                                                                      |

### 2.2 Decisões técnicas explicitamente pendentes no PRD — **não** fechadas neste plano

- **Biblioteca de mapas:** PRD §12.1 delega a `/docs/DESIGN.md`; o `DESIGN.md` não menciona mapas. Fica em aberto até a Fase 8; a UI de mapa será isolada atrás de um componente `<UnitMap>` para permitir troca.
- **Zod vs. DTOs do NestJS:** PRD §12.1 permite ambos, exigindo schemas compartilhados. Adotado **Zod em `packages/schemas`** como fonte única, consumido por API e web — registrado como ADR-0004, reversível.
- **PostGIS:** PRD §15.4 diz "se disponível". Avaliado na Fase 8.
- **RPO/RTO, retenção, base legal:** PRD §13.2/§15.6 exigem definição com a SME. Fora do MVP.

### 2.3 Conflitos entre PRD.md e DESIGN.md

| #    | Conflito                                                                                                                                                                                     | Resolução aplicada                                                                                                                                                                                                                                                                                                                                                       |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C-01 | `DESIGN.md` §Known Gaps: "Form validation and error states were not surfaced". `PRD.md` §17 e §20 exigem validação inline, resumo de erros e estados de loading/vazio/erro/sucesso           | Conforme `PRD.md` §1.1, foi criada uma camada **mínima e provisória** de estados de formulário, derivada apenas de tokens já existentes no `DESIGN.md` (`{colors.primary-focus}`, `{colors.hairline}`, `{typography.caption}`). Nenhum token novo de marca foi inventado. Marcado como provisório em `docs/DECISIONS.md` (ADR-0006) — requer validação do time de design |
| C-02 | `DESIGN.md` exige variante de logotipo para fundo azul no `global-nav`; `/img/logo` contém apenas _horizontal monocromática preto_ e _vertical monocromática azul_ — nenhuma negativa/branca | `TODO` explícito registrado (DESIGN.md instrui a não inventar variante). Provisoriamente o ativo oficial **inalterado** é apresentado sobre uma área de proteção clara dentro da navegação azul. Sem recolorir, mascarar ou redesenhar                                                                                                                                   |
| C-03 | `DESIGN.md` descreve cor de status apenas institucional; `PRD.md` §17 exige "não depender apenas de cor para status"                                                                         | Todos os status usam ícone/rótulo textual além de cor. Nenhuma paleta semântica nova (sucesso/erro) foi introduzida na marca — estados usam neutros e `{colors.primary}`                                                                                                                                                                                                 |
| C-04 | `DESIGN.md` sugere **Inter** via Google Fonts; `PRD.md` §13.5 exige CSP restritiva e §13.4 evita dependências externas não controladas                                                       | Fase 1 usa apenas a pilha `system-ui`/`-apple-system` (que resolve para SF Pro real em Apple, conforme DESIGN.md). Auto-hospedagem do Inter fica para a Fase 14 (ADR-0005)                                                                                                                                                                                               |
| C-05 | `DESIGN.md` foi escrito descrevendo páginas de e-commerce (tiles de produto, "Add to Bag", configurador)                                                                                     | Os **tokens e specs de componente** são aplicados; a semântica de e-commerce é mapeada para o domínio (ex.: `product-tile-light` → seção institucional de largura total). Nenhuma alteração de token                                                                                                                                                                     |
| C-06 | `DESIGN.md` §Iteration Guide 4: "Never document hover"                                                                                                                                       | Nenhum estado de hover é especificado; foco e `:active` (`scale(0.95)`) são implementados conforme o documento                                                                                                                                                                                                                                                           |

---

## 3. Convenções de execução

- Fases pequenas, verificáveis e independentemente entregáveis; nenhuma fase implementa o MVP inteiro.
- Gates obrigatórios ao fim de **toda** fase (PRD §14.8): `lint`, `typecheck`, `test`, `build` — mais `integration`/`e2e` quando a fase os introduzir.
- Nenhum segredo no repositório; apenas `.env.example` com valores fictícios (PRD §13.4).
- Nenhum commit, push ou deploy é executado pelo agente.
- Toda decisão arquitetural entra em `docs/DECISIONS.md` (PRD §20).
- Nada é sobrescrito sem justificativa registrada aqui.

---

## 4. Fases

### Fase 1 — Fundação técnica + primeira fatia funcional ponta a ponta ✅ CONCLUÍDA

**Objetivo.** Estabelecer o monorepo, os gates de qualidade e uma fatia vertical fina que atravesse web → API → domínio → resposta, provando a arquitetura sem depender de banco de dados.
Cobre PRD §19 Fase 0 e a primeira parcela de **RF-01**.

**Funcionalidades.**

- Monorepo pnpm + Turborepo com TypeScript `strict`, ESLint, Prettier, Vitest.
- `packages/domain`: cálculo de grupamento etário por política **versionada e parametrizada** (PRD §8.1).
- `packages/schemas`: contratos Zod compartilhados entre API e web.
- `packages/ui`: tokens do `/docs/DESIGN.md` como CSS custom properties.
- `apps/api` (NestJS): `GET /health/live`, `GET /health/ready`, `POST /applications`, `GET /applications/:id`, `PATCH /applications/:id` (PRD §12.4), com repositório em memória atrás de uma porta.
- `apps/web` (Next.js): navegação global, rodapé, página institucional e etapa 1 da inscrição, exibindo o grupamento calculado com explicação estruturada.
- Segurança de base: helmet, CORS por allowlist, rate limiting, limite de payload, IDs não sequenciais, idempotência em escrita, logs JSON com correlation ID e redação de PII.
- `docker-compose.yml` (Postgres + Redis) e workflow de CI com os gates de PRD §14.8 — entregues como artefatos da fundação; o compose só passa a ser usado na Fase 2.

**Dependências.** Nenhuma. Ponto de partida.

**Critérios de aceite.**

- Grupamento calculado por função de domínio pura, testável e parametrizada.
- Alterar nascimento **ou** data de referência recalcula o grupamento (via `PATCH`).
- A jornada é concluível sem qualquer dado real.
- `POST /applications` repetido com a mesma `Idempotency-Key` não cria segunda inscrição.
- Entrada inválida é rejeitada no limite da API com erro estruturado, sem stack trace.
- A página respeita tokens do `DESIGN.md`, é navegável por teclado e possui estados de loading/erro/sucesso.
- Logotipo carregado de `/img/logo`, inalterado, com `alt` adequado.

**Testes necessários.** Unitários de domínio (cobertura ≥ 90%), unitários de schemas, testes de integração HTTP da API (health, criação, recálculo, idempotência, validação, 404), teste de componente da web, smoke E2E Playwright, além de lint/typecheck/build.

**Riscos.**

- _Técnico:_ a política de grupamento é **demonstrativa**; tratá-la como oficial seria erro de produto → mitigado por rótulo `DEMONSTRACAO` no dado e na UI.
- _Técnico:_ repositório em memória perde estado ao reiniciar → aceitável, substituído na Fase 2 pela mesma porta.
- _Segurança:_ CORS/rate limit permissivos em dev → allowlist explícita via env, sem curinga.
- _Segurança:_ PII em logs → middleware de redação + testes.

---

### Fase 2 — Persistência canônica ✅ CONCLUÍDA

**Objetivo.** Trocar o repositório em memória por PostgreSQL/Prisma sem alterar o domínio.

**Funcionalidades.**

- `packages/database` (`@match/database`) com schema Prisma cobrindo `Process`, `RuleVersion`, `Child`, `Guardian`, `Application`, `StatusEvent` e `AuditEvent` (PRD §11).
- Três migrations versionadas, incluindo triggers de append-only e check constraints.
- `seed.ts` sintético e idempotente, que publica o processo de demonstração e a versão de regra de grupamento.
- `PrismaApplicationRepository` atendendo a porta existente; adapter em memória removido.
- `RuleVersionService`: a política de grupamento passa a vir do banco, revalidada por Zod a cada leitura.
- `AuditService` com redação de PII compartilhada com os logs; `StatusEvent` registrando cada transição.
- `/health/ready` trata o PostgreSQL como dependência crítica.

**Dependências.** Fase 1. **B-02 resolvido de outra forma:** a máquina já tinha PostgreSQL 16.13 via Homebrew, então a fase seguiu sem Docker. O `docker-compose.yml` continua válido como alternativa e permanece não executado.

**Critérios de aceite.** Migrations aplicam (rollback não é suportado pelo Prisma — ver ADR-0016); constraints de PRD §11.1 aplicáveis existem; nenhum endpoint mudou de contrato; auditoria registra ator, papel, ação, entidade, instante UTC, correlation ID e origem, sem PII.

**Testes.** 79 testes na API contra PostgreSQL real, cobrindo escrita transacional, durabilidade, auditoria, append-only, constraints, regra versionada e idempotência do seed.

**Riscos remanescentes.** O banco de teste é compartilhado entre arquivos da suíte; `fileParallelism: false` protege dentro do processo, mas duas execuções simultâneas de `pnpm --filter @match/api test` se atropelariam no `TRUNCATE`.

---

### Fase 3 — Pipeline de dados (DuckDB) e unidades ✅ CONCLUÍDA

**Objetivo.** Ingerir os arquivos históricos em TypeScript/DuckDB e publicar tabelas curadas.

**Funcionalidades.**

- `packages/data-pipeline` (`@match/data-pipeline`) com `@duckdb/node-api` 1.5.5, lendo `.csv.gz`, `.csv` sem cabeçalho, `.xlsx` e shapefile sem materializar as bases em memória.
- Normalização na fronteira de leitura: códigos de unidade, CEP, marcadores `NULL` e texto. Cada regra existe em TypeScript (testável) e em SQL (executável dentro do DuckDB), com teste de paridade entre as duas.
- `cur_unidades` fecha a lacuna geográfica cruzando o catálogo de endereços com `Unidades_Unificadas_com_Localizacao.xlsx` — a única fonte de latitude, longitude, CRE e microárea nos datasets (ADR-0019).
- Microáreas SME/IPP reprojetadas de EPSG:31983 para WGS84, no mesmo referencial das coordenadas das unidades.
- Manifesto por importação com origem, tamanho, SHA-256, data e versão; publicação em Parquet ZSTD versionada por diretório.
- Relatório de qualidade com dez achados classificados por severidade, cobrindo as validações de PRD §10.4.

**Dependências.** Fase 2. **B-01 resolvido:** datasets baixados para `data/raw/` (não versionados).

**Critérios de aceite.** Publicação falha se o diretório da versão já existir; códigos e CEPs preservam zeros à esquerda; contagens da origem e unicidade de chaves são conferidas antes de escrever qualquer Parquet; a reconciliação do catálogo de unidades garante que nenhuma linha suma em silêncio.

**Testes.** 35 testes: normalização pura, paridade SQL×TypeScript, ETL sobre fixtures de todos os quatro formatos, não-regressão do relatório e os portões de publicação (contagem divergente, chave duplicada, perda de linha, versão já existente, origem ausente).

**O que os dados revelaram e o plano não previa.**

- **Não há coordenada nem CRE nos arquivos da pasta de inscrições.** A geografia veio de outro diretório do mesmo repositório, descoberto depois (`OferecimentosEvagas/`).
- **`esc_codigo` não é chave única.** 78 códigos aparecem em mais de uma linha do catálogo, e 74 desses grupos divergem em nome ou endereço. Entre as parceiras há códigos genuinamente reaproveitados por instituições diferentes. 40 deles aparecem nas inscrições. Resolvido por desduplicação determinística (ADR-0020).
- **24 unidades têm `esc_codigo` gravado como `NULL`.** Nenhuma aparece nas inscrições, mas ficam fora das tabelas curadas por não terem chave, e por isso são contabilizadas no relatório.
- **As larguras do código divergem entre fontes.** A planilha guardou o código como número e perdeu os zeros à esquerda; reancorar por largura recupera 852 das 872 unidades citadas, sem colisão (ADR-0018).

**Riscos remanescentes.** O `INSTALL` das extensões `excel` e `spatial` busca na rede na primeira execução — offline, a ingestão não sobe. Os arquivos de oferta e vagas (`OferecimentosEvagas/`) e `NascidosvivosRJ.xlsx` foram baixados mas **não** são ingeridos: são insumos das Fases 8 e 13, e o risco de PRD §21 "Capacidade" segue aberto.

---

### Fase 4 — Pontos de referência por CEP (RF-02) ✅ CONCLUÍDA

**Objetivo.** Permitir de um a três âncoras de localização com geocodificação simulada.

**Funcionalidades.**

- `LocationAnchor` no schema canônico, com invariantes de PRD §8.2 impostas por check constraint: no máximo três posições, a posição 1 é sempre a residência, coordenada é um par indivisível, e `RESOLVIDO` exige coordenada e incerteza.
- Porta `GeocodingProvider` com adapter determinístico ancorado nos CEPs reais das unidades escolares (ADR-0023). Sem rede, sem relógio, sem aleatoriedade.
- `GET`, `POST` e `DELETE` em `/applications/:id/location-anchors`, mais `GET /neighborhoods` para o fallback de PRD §8.2.
- Sinalização de CEP duplicado — **sinalização, não recusa**: repetir um CEP entre residência e trabalho é uma escolha legítima da família.
- Etapa 2 da interface, com a incerteza da localização dita em português e a promessa explícita de que os pontos não pontuam.
- `normalizeCep` movida para `@match/domain`, compartilhada entre o pipeline de ingestão e a validação da API (ADR-0025).

**Dependências.** Fases 2 e 3. **B-03 contornado, não resolvido:** nenhum provider real foi escolhido.

**Critérios de aceite.** Conclusão possível apenas com o CEP residencial, coberto por E2E; a residência não pode ser removida; os dois pontos opcionais podem ser adicionados e removidos; falha de geocodificação não bloqueia a inscrição; os pontos não alteram o grupamento nem a pontuação, verificado comparando a resposta antes e depois.

**Testes.** 33 novos: 7 unitários do provider, 17 de integração HTTP contra PostgreSQL real, 9 de componente e 3 E2E com servidores reais.

**O que os dados decidiram.** A referência cobre 353 setores de CEP, construída a partir do centroide das unidades de cada setor. Resolve 89% dos 21.688 CEPs distintos que aparecem nos cinco processos históricos; os 11% restantes falham de verdade, o que exercita o caminho por bairro que PRD §8.2 exige em vez de deixá-lo como código morto.

**Riscos remanescentes.** A precisão é do tamanho do setor, não do endereço: raio mediano de 750 m, mas com cauda até 10,7 km. A interface declara essa margem, e a Fase 6 precisa decidir se ordena unidades por uma estimativa dessa granularidade. A **busca textual** de unidades citada em PRD §8.2 depende do catálogo de unidades no banco e fica com a Fase 6; esta fase entrega a lista de bairros que a alimenta.

---

### Fase 5 — Contatos multicanal e redes sociais (RF-03, RF-04) ✅ CONCLUÍDA

**Objetivo.** Cadastro de telefones e perfis sociais com consentimentos e verificação simulada.

**Funcionalidades.**

- `ContactPoint` unificado: telefone e perfil social na mesma tabela, porque as regras que importam são sobre o **conjunto** — exatamente um principal, nunca ficar sem telefone, rede social nunca como único contato — e precisam enxergar todos os canais de uma vez.
- E.164 brasileiro com validação de DDD e de faixa de assinante, no domínio.
- Consentimento por meio (ligação, SMS, WhatsApp), nenhum presumido além da ligação; SMS e WhatsApp recusados em telefone fixo.
- Autorização de terceiro exigida quando a relação a caracteriza, imposta também por check constraint.
- OTP simulado, guardado apenas como hash, com expiração e limite de tentativas.
- Índice cego HMAC para detectar contato repetido sem comparar o valor (ADR-0027).
- Mascaramento na fronteira: o valor completo nunca sai da API.
- Etapa 3 da interface, com os consentimentos explícitos e o aviso de que a verificação é simulada.

**Dependências.** Fase 2.

**Critérios de aceite.** Exatamente um telefone principal, reconciliado a cada escrita; o único telefone não pode ser removido, nem havendo perfis sociais; rede social nunca é o único contato; `@handle` tratado como mutável, com `platformUserId` reservado para vinculação futura; rótulo e handle recusam caracteres de marcação.

**Testes.** 61 novos: 27 de integração HTTP contra PostgreSQL real, 7 do índice cego, 22 de regras puras no domínio (E.164, mascaramento, invariantes), 12 de componente e 6 E2E.

**A decisão que ficou pela metade, conscientemente.** PRD §13.4 pede criptografar telefone e perfis "quando viável". Foi implementado apenas o **índice cego**, e o valor continua em texto (ADR-0027). O índice é um HMAC com chave, e não um hash simples, porque o espaço de telefones brasileiros tem menos de 10¹¹ combinações — um hash sem segredo seria revertido por força bruta e não mascararia nada. A cifragem em si fica para a Fase 14, e a estrutura permite adicioná-la sem migrar dados.

**Riscos remanescentes.** O valor completo em texto é dívida assumida, não esquecimento. `CONTACT_FINGERPRINT_KEY` não tem rotação: trocar a chave invalida os índices gravados e a detecção de duplicidade para de funcionar para os contatos antigos até serem reescritos. TikTok permanece adapter simulado (B-06), e nenhuma verificação real de perfil acontece.

---

### Fase 6 — Recomendação de unidades e preferências (RF-05, RF-06)

**Objetivo.** Recomendar unidades compatíveis e capturar até cinco preferências ordenadas.
**Funcionalidades.** `GET /units/recommendations` com filtros; distância geodésica rotulada como estimativa; explicação da recomendação a partir de dados estruturados; `PUT /applications/:id/preferences`; reordenação por drag-and-drop **e** por controles acessíveis; alertas informativos.
**Dependências.** Fases 3, 4.
**Critérios de aceite.** Card exibe todos os campos de PRD §8.5; recomendação não impede escolha livre; unicidade de unidade por grupamento/turno.
**Testes.** Ordenação por ponto de referência; unicidade; E2E de reordenação por teclado; a11y da lista.
**Riscos.** Sem mapa ainda (decisão pendente §2.2) — a lista equivalente (PRD §17) é entregue primeiro, o que também garante a alternativa textual.

---

### Fase 7 — Motor de pontuação versionado (RF-07)

**Objetivo.** Reconstruir pontuação determinística e explicável por versão de regra.
**Funcionalidades.** `packages/matching-engine` (parte de pontuação); `Criterion`, `CriterionResponse`, `ScoreResult`; `POST /score-runs`, `GET /score-runs/:id`; explicação estruturada; nova versão nunca reescreve histórico.
**Dependências.** Fases 3 (catálogo de perguntas), 5.
**Critérios de aceite.** Todos os de PRD §8.7; nenhuma inferência de LLM decide números.
**Testes.** Pontuação por processo/ano; desempates; imutabilidade de versão; cobertura ≥ 90% no pacote.
**Riscos.** Regras oficiais de desempate não confirmadas (B-07) → configuração versionada rotulada.

---

### Fase 8 — Motor de alocação determinístico (RF-08)

**Objetivo.** Alocar por preferências garantindo os invariantes obrigatórios.
**Funcionalidades.** Algoritmo inspirado em deferred acceptance; `AllocationRun`, `Allocation`; `POST /allocation-runs`, `GET /allocation-runs/:id`; execução em worker; saídas de simulação de PRD §8.8.
**Dependências.** Fases 6, 7.
**Critérios de aceite.** Todos os invariantes de PRD §8.8; mesma entrada + versão ⇒ mesma saída; toda decisão explicável.
**Testes.** **Testes baseados em propriedades** de PRD §14.2 (oferta única, capacidade, preferências, determinismo, terminação, sem perda/duplicação); benchmark com 100 mil inscrições.
**Riscos.** Complexidade/tempo de execução (PRD §15.3, meta de 5 min) → medir e registrar no runbook; nunca executar no request HTTP.

---

### Fase 9 — Comparador de cenários (RF-09)

**Objetivo.** Comparar estado histórico, resultado proposto e cenários de capacidade.
**Funcionalidades.** Cenários temporários que não alteram dados-base; aviso permanente de dado anonimizado.
**Dependências.** Fase 8.
**Critérios de aceite.** Comparação sempre rotulada como não oficial; cenário isolado e descartável.
**Testes.** Isolamento do cenário; reprodutibilidade.
**Riscos.** Interpretação indevida dos indicadores → rótulo obrigatório em toda superfície (PRD §1.2).

---

### Fase 10 — Auth simulada, RBAC e painel da CRE (RF-10)

**Objetivo.** Escopo territorial no backend e painel operacional.
**Funcionalidades.** Auth simulada identificada; RBAC por perfil de PRD §6.6; escopo por CRE; `GET /dashboards/operations` paginado por cursor; contatos mascarados; exportação com permissão específica e auditoria.
**Dependências.** Fases 2, 6.
**Critérios de aceite.** PRD §8.10 completo; ocultação de UI nunca é o único controle.
**Testes.** Autorização por objeto e território; IDOR/BOLA; enumeração; rate limiting; E2E "operador sem permissão".
**Riscos.** Vazamento entre territórios — risco de segurança mais alto do MVP; exige testes negativos abrangentes.

**Antecipação parcial (ADR-0029).** A **interface** do painel foi construída fora de ordem, sobre um conjunto sintético declarado, para validar com o gestor quais leituras importam antes de investir na Fase 6. Já existem em `/gestor`: contagem de inscrições e funil por status, unidades mais procuradas com razão candidato/vaga, fila por unidade, por CRE e por grupamento etário, recorte cruzado por território/grupamento/turno, e comparação com os processos anteriores no mesmo dia da janela. Supressão de célula com menos de cinco inscrições já é aplicada (PRD §13.2).

O que a fase **ainda deve entregar**: a consulta real (depende de `Unit` e `Preference`, Fase 6), auth simulada, RBAC, escopo territorial imposto no repositório, paginação por cursor, contatos mascarados, exportação com permissão específica e auditoria — e os testes negativos de IDOR/BOLA e de vazamento entre CREs. Hoje qualquer perfil vê a rede inteira, e a própria página declara isso.

---

### Fase 11 — Convocação rastreável e adapters (RF-11, RF-12, RF-14)

**Objetivo.** Máquina de estados de convocação com tentativas multicanal simuladas.
**Funcionalidades.** Estados de PRD §8.11; BullMQ/Redis com filas separadas, backoff e dead-letter; `packages/channel-adapters` com a interface `ChannelAdapter` de PRD §14.4; `ContactAttempt`; templates versionados por canal; ordem de canais parametrizável por processo.
**Dependências.** Fases 2, 5, 8.
**Critérios de aceite.** PRD §8.11 e §8.12 completos; processamento idempotente; aceite encerra as demais opções transacionalmente.
**Testes.** Contract tests de adapters; relógio controlado para prazos; expiração/extensão; reprocessamento sem duplicação; E2E dos cenários 6–9 de PRD §14.5.
**Riscos.** Duplicação de convocação (meta zero) → idempotency key obrigatória; PII em mensagens (PRD §8.14) → teste de conteúdo de template.

---

### Fase 12 — Resposta pública da família (RF-13)

**Objetivo.** Página pública por token de uso único e prazo limitado.
**Funcionalidades.** Aceitar, recusar, solicitar extensão, atualizar canais; token armazenado apenas como hash.
**Dependências.** Fase 11.
**Critérios de aceite.** PRD §8.13; token expira e invalida após uso; link apenas para domínio permitido.
**Testes.** Reuso de token consumido/expirado; CSRF; rate limiting; enumeração.
**Riscos.** Superfície pública — maior exposição; exige CAPTCHA configurável (PRD §13.5) e cabeçalhos rígidos.

---

### Fase 13 — Planejamento territorial e simulador (RF-15)

**Objetivo.** Mapa e indicadores agregados com simulação de capacidade.
**Funcionalidades.** Decisão da biblioteca de mapas (§2.2); camadas de unidades, CREs e microáreas; nascidos vivos por bairro/ano; `GET /dashboards/planning`; simulador de capacidade em cenário temporário; lista equivalente ao mapa.
**Dependências.** Fases 3, 9.
**Critérios de aceite.** PRD §8.15; dados-base nunca alterados; alternativa textual completa.
**Testes.** Agregações; isolamento do cenário; a11y do mapa e da lista.
**Riscos.** Volume geoespacial → agregados pré-calculados/materialized views (PRD §15.4).

---

### Fase 14 — Observabilidade, hardening e fechamento

**Objetivo.** Atingir a Definition of Done de PRD §20.
**Funcionalidades.** OpenTelemetry ponta a ponta (PRD §16.3), métricas Prometheus-compatible, CSP/HSTS e demais cabeçalhos, SBOM, secret scanning/SAST no CI, `docs/RUNBOOK.md`, `docs/SECURITY.md`, `docs/DATA_DICTIONARY.md`, auto-hospedagem de fonte (C-04), testes de carga (PRD §15.2), revisão WCAG 2.2 AA.
**Dependências.** Todas as anteriores.
**Critérios de aceite.** Todos os gates de PRD §14.8 verdes; nenhuma vulnerabilidade crítica aberta; benchmarks registrados no runbook.
**Testes.** Carga nos volumes de PRD §15.2; suíte de segurança de PRD §14.6; a11y automática + manual de PRD §14.7.
**Riscos.** Metas de desempenho de PRD §15.3 podem não ser atingíveis no hardware disponível → registrar o ambiente de referência em vez de ajustar a meta.

---

## 5. Registro de decisões menores adotadas nesta fase

Detalhadas em `docs/DECISIONS.md`:

- **ADR-0001** — pnpm workspaces + Turborepo (PRD §12.1).
- **ADR-0002** — TypeScript 5.9 em vez de 7.x, por compatibilidade de `emitDecoratorMetadata` com NestJS. Revisão na Fase 14.
- **ADR-0003** — Porta de repositório com adapter em memória na Fase 1, substituído por Prisma na Fase 2.
- **ADR-0004** — Zod em `packages/schemas` como fonte única de validação (opção permitida por PRD §12.1).
- **ADR-0005** — Pilha de fontes do sistema na Fase 1; auto-hospedagem do Inter adiada (C-04).
- **ADR-0006** — Estados de formulário provisórios, derivados de tokens existentes (C-01).
- **ADR-0007** — Política de grupamento etário como dado versionado e rotulado `DEMONSTRACAO` (B-07).
- **ADR-0008** — Área de proteção clara para o logotipo na navegação azul, com `TODO` pela variante negativa (C-02).
- **ADR-0009** — `@match/ui` consumido por `transpilePackages`, sem etapa de build própria.
- **ADR-0010** — CSP sem origem externa, mantendo `'unsafe-inline'` temporariamente; nonce na Fase 14.
- **ADR-0011** — Build da API por `tsc`; `@nestjs/cli` removido por incompatibilidade com Node 22.
- **ADR-0012** — Grupamento derivado na leitura, nunca persistido, garantindo o recálculo de PRD §8.1.

### Decisões da Fase 2

- **ADR-0013** — Adapter Prisma substitui o repositório em memória, que foi removido em vez de mantido em paralelo.
- **ADR-0014** — A regra de grupamento migra da constante de código para `RuleVersion` no banco.
- **ADR-0015** — Append-only imposto por trigger no PostgreSQL, não por convenção de aplicação.
- **ADR-0016** — Prisma em `packages/database` em vez de `prisma/` na raiz; desvio justificado de PRD §12.2.
- **ADR-0017** — Variáveis de banco declaradas em `globalEnv` do Turbo.

### Decisões da Fase 3

- **ADR-0018** — Código de unidade reancorado por largura (5 dígitos para parceiras, 7 para públicas).
- **ADR-0019** — `Unidades_Unificadas_com_Localizacao.xlsx` como fonte canônica de coordenada, CRE e microárea.
- **ADR-0020** — Desduplicação determinística do catálogo de unidades, com as linhas descartadas registradas.
- **ADR-0021** — Regras de normalização escritas duas vezes (SQL e TypeScript), com teste de paridade.
- **ADR-0022** — Publicação versionada em Parquet, sem sobrescrita e sem ponteiro para "última".

### Decisões da Fase 4

- **ADR-0023** — Geocodificação simulada ancorada no setor de CEP das unidades reais, não em hash sintético.
- **ADR-0024** — A incerteza é publicada junto da coordenada, e setor com uma única unidade não é tratado como preciso.
- **ADR-0025** — `normalizeCep` no domínio, compartilhada entre a ingestão e a API.
- **ADR-0026** — CEP duplicado na mesma inscrição é sinalizado, nunca recusado.

### Decisões da Fase 5

- **ADR-0027** — Índice cego com HMAC para duplicidade de contatos; cifragem do valor adiada com dívida explícita.
- **ADR-0028** — `ContactPoint` unificado por canal, em vez de tabelas separadas para telefone e rede social.
- **ADR-0029** — Interface do painel do gestor antecipada sobre conjunto sintético determinístico, com derivações puras e tipos no formato da consulta real.
- **ADR-0030** — Razão candidato/vaga medida pela primeira opção; severidade dita por extenso, sem semáforo de cor.
