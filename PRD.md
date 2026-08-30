# PRD - Match Perfeito: Inteligência na Inscrição de Creche

**Versão:** 1.0  
**Status:** Pronto para desenvolvimento do MVP  
**Data:** 30/08/2026  
**Contexto:** Hackathon SME-Rio + Rio Impact Lab 2026  
**Plataforma:** Aplicação web responsiva  
**Stack obrigatória:** JavaScript/TypeScript em todos os componentes da aplicação

---

## 1. Instruções obrigatórias para o Claude Code

Antes de alterar ou criar qualquer código, o agente de desenvolvimento deve:

1. Ler integralmente este `PRD.md`.
2. Ler integralmente o arquivo `/docs/DESIGN.md`, localizado na pasta `/docs` na raiz do projeto.
3. Inspecionar a estrutura existente do repositório e os datasets antes de propor mudanças.
4. Implementar em incrementos pequenos, testáveis e rastreáveis.
5. Executar lint, verificação de tipos, testes e build antes de considerar uma etapa concluída.

### 1.1 Fonte de verdade do design

Toda a definição visual da aplicação estará em:

```text
/docs/DESIGN.md
```

O `/docs/DESIGN.md` é a única fonte de verdade para:

- cores;
- tipografia;
- espaçamentos;
- grids;
- ícones;
- componentes;
- estados visuais;
- responsividade;
- acessibilidade visual;
- padrões de formulário, mapas, tabelas, cards, modais e dashboards.

Este PRD define comportamento, regras de negócio e requisitos técnicos. O `DESIGN.md` define a apresentação visual. Em caso de conflito visual, o `/docs/DESIGN.md` prevalece. O Claude Code não deve inventar um design system paralelo, duplicar tokens visuais neste PRD ou substituir decisões do `DESIGN.md` sem autorização.

Se o `/docs/DESIGN.md` estiver ausente ou incompleto, o agente deve registrar o bloqueio e usar apenas uma estrutura visual mínima e provisória, sem consolidar novas decisões de design como definitivas.

### 1.2 Restrições de implementação

- Não utilizar Python, R ou outra linguagem no produto ou no pipeline de dados.
- Utilizar TypeScript com modo `strict`.
- Não enviar mensagens reais no MVP; utilizar adaptadores simulados por padrão.
- Não utilizar LLM ou modelo probabilístico para decidir pontuação, prioridade ou alocação de vagas.
- Não apresentar indicadores dos dados anonimizados como retrato oficial da realidade do município.
- Não armazenar segredos, tokens ou credenciais no repositório.
- Não utilizar dados pessoais reais no ambiente de desenvolvimento ou na demonstração.

---

## 2. Resumo executivo

O Match Perfeito é um MVP para reduzir as principais dores do processo de inscrição, classificação e convocação de vagas em creches e Espaços de Desenvolvimento Infantil do Município do Rio de Janeiro, atendendo crianças de aproximadamente 6 meses a 3 anos.

A solução conecta três momentos hoje tratados de forma fragmentada:

1. **Inscrição assistida:** ajuda a família a escolher até cinco unidades viáveis considerando residência, trabalho e rede de apoio.
2. **Classificação otimizada:** aplica regras oficiais e versionadas, respeita a ordem de preferência e impede que uma mesma criança mantenha múltiplas ofertas simultâneas.
3. **Convocação rastreável:** organiza tentativas multicanal, prazos, respostas e liberação automática da vaga para a próxima criança.

O MVP também oferece uma visão territorial de planejamento, combinando demanda histórica, oferta, ocupação, unidades, microáreas e nascidos vivos.

---

## 3. Contexto e problema

O processo de Inscrição Creche permite que o responsável escolha até cinco unidades por ordem de preferência. A retaguarda envolve a SME, 11 Coordenadorias Regionais de Educação - CREs, polos de avaliação e unidades escolares.

Os materiais analisados identificam as seguintes dores:

- escolha de unidades sem apoio suficiente de distância, território ou rotina familiar;
- filas que podem refletir preferência territorial, e não apenas falta global de vagas;
- classificação e acompanhamento orientados por opções, gerando múltiplas reservas para a mesma criança;
- regras de pontuação que mudam entre processos e precisam ser explicáveis;
- ausência de histórico temporal completo das mudanças de status;
- checagem manual de inconsistências entre opções da mesma inscrição;
- convocação manual, descentralizada e repetitiva;
- contatos desatualizados ou insuficientes;
- ausência de rastreabilidade consolidada das tentativas de contato;
- estruturas heterogêneas nos arquivos de oferta e ocupação.

### 3.1 Escala de referência

O repositório histórico contém, entre outros dados:

- 837.179 opções de creche;
- 343.308 inscrições;
- aproximadamente 260 mil crianças anonimizadas;
- 872 unidades presentes nas inscrições;
- mais de 4,3 milhões de respostas socioeconômicas;
- processos seletivos de 2021 a 2025.

Os dados foram anonimizados. Seus indicadores não representam necessariamente a realidade, mas preservam estrutura, relacionamentos e dinâmicas suficientes para construção e demonstração do MVP.

---

## 4. Objetivos

### 4.1 Objetivo principal

Demonstrar que uma jornada integrada, territorial e multicanal pode melhorar a qualidade das escolhas, eliminar ofertas simultâneas para a mesma criança e dar rastreabilidade à convocação.

### 4.2 Objetivos específicos

- Permitir que a família informe até três pontos de referência por CEP.
- Recomendar unidades compatíveis com idade, turno e rotina territorial.
- Permitir até cinco preferências ordenadas.
- Cadastrar múltiplos meios de contato, com um telefone obrigatório.
- Permitir redes sociais opcionais como canais adicionais de contato.
- Aplicar pontuação e desempates por regras versionadas.
- Executar simulação de alocação com no máximo uma oferta por criança.
- Automatizar, de forma simulada, tentativas e prazos de convocação.
- Sinalizar inconsistências e itens que exigem ação humana.
- Exibir demanda, oferta e ocupação em mapa e cenários de planejamento.
- Garantir explicabilidade, auditabilidade, segurança e acessibilidade.

### 4.3 Não objetivos do MVP

- Substituir o sistema oficial de matrícula.
- Alterar critérios legais ou políticos de priorização.
- Escrever dados em sistemas da SME.
- Enviar mensagens reais por WhatsApp, SMS, e-mail ou redes sociais.
- Integrar-se ao Registro Municipal Integrado - RMI.
- Operar com dados pessoais reais.
- Criar aplicativo móvel nativo.
- Prever demanda por meio de modelo de machine learning.
- Prometer probabilidade real de conseguir vaga.
- Implantar autenticação corporativa definitiva.

---

## 5. Premissas

- O MVP será uma demonstração de hackathon.
- O acesso técnico estará limitado aos arquivos do repositório público.
- Integrações externas serão representadas por adapters e mocks.
- O processo de 2026 não está nos datasets de inscrição.
- A capacidade será normalizada a partir dos arquivos disponíveis ou complementada por dados de demonstração claramente identificados.
- Tempos e transições de convocação ausentes na base serão simulados.
- A classificação será determinística, reproduzível e explicável.
- CEPs e contatos não alteram a prioridade oficial; servem para escolha e comunicação.

---

## 6. Personas e perfis de acesso

### 6.1 Responsável familiar

Deseja encontrar uma creche compatível com a idade da criança e com sua rotina, acompanhar a inscrição e responder rapidamente a uma convocação.

### 6.2 Operador de CRE ou polo

Monitora filas, vagas, prazos, inconsistências e convocações das unidades sob sua responsabilidade.

### 6.3 Operador da unidade escolar

Acompanha as convocações atribuídas à unidade e registra tentativas, respostas e confirmações.

### 6.4 Gestor central da SME

Configura processos e regras, acompanha indicadores agregados e simula cenários territoriais.

### 6.5 Auditor ou administrador

Consulta regras aplicadas, eventos, alterações, execuções de classificação e trilhas de auditoria.

### 6.6 Matriz de acesso mínima

| Perfil | Escopo |
| --- | --- |
| Família | Apenas a própria inscrição e seus canais |
| Unidade | Inscrições e convocações da própria unidade |
| CRE/polo | Unidades e inscrições de seu território |
| SME central | Visão municipal, configurações e simulações |
| Auditor | Leitura de regras, resultados e logs de auditoria |
| Administrador | Configuração técnica, sem acesso irrestrito por padrão aos dados pessoais |

---

## 7. Princípios de produto

1. **Melhor interesse da criança:** toda decisão de produto deve considerar proteção e benefício da criança.
2. **Regra pública, não caixa-preta:** pontuação e alocação precisam ser reproduzíveis.
3. **Uma criança, uma oferta:** nenhuma execução deve manter múltiplas ofertas ativas para a mesma criança.
4. **Escolha informada:** distância e rotina orientam a família, mas não restringem arbitrariamente sua escolha.
5. **Contato por redundância:** múltiplos canais reduzem falhas sem expor dados sensíveis.
6. **Humano no controle:** exceções e casos ambíguos devem permitir revisão humana.
7. **Privacidade por padrão:** coletar o mínimo necessário e evitar exposição em logs, mensagens e dashboards.
8. **Acessibilidade:** a jornada deve ser utilizável por pessoas com diferentes níveis de letramento e necessidades assistivas.

---

## 8. Escopo funcional

### 8.1 RF-01 - Inscrição assistida

O sistema deve permitir criar uma inscrição de demonstração contendo:

- identificador anônimo da criança;
- mês e ano de nascimento;
- sexo, quando aplicável ao dataset;
- processo seletivo;
- grupamento etário calculado para a data de referência;
- turno desejado: integral, parcial ou ambos;
- respostas aos critérios socioeconômicos simulados;
- responsável anônimo;
- contatos e pontos de referência.

#### Critérios de aceite

- O grupamento deve ser calculado por função de domínio testável e parametrizada.
- Alterar nascimento ou data de referência deve recalcular o grupamento.
- Nenhum dado real deve ser necessário para concluir a demonstração.
- O formulário deve salvar rascunho local ou no backend de demonstração.

### 8.2 RF-02 - Pontos de referência por CEP

A família poderá informar de um a três CEPs:

1. **Residência:** obrigatório.
2. **Segundo ponto:** opcional, normalmente trabalho.
3. **Terceiro ponto:** opcional, normalmente familiar ou rede de apoio.

Cada ponto deve conter:

- CEP;
- tipo: `HOME`, `WORK`, `SUPPORT` ou `OTHER`;
- rótulo amigável;
- ordem de importância opcional;
- latitude e longitude derivadas por serviço ou mock de geocodificação;
- status de geocodificação;
- data da última validação.

#### Regras

- CEP deve ser armazenado como texto, preservando zeros à esquerda.
- O CEP de residência é obrigatório.
- CEPs duplicados na mesma inscrição devem ser sinalizados.
- Os pontos servem apenas à recomendação e não alteram a pontuação oficial.
- A interface deve permitir comparar cada unidade com cada ponto informado.
- Se a geocodificação falhar, a família ainda poderá escolher unidades por bairro ou busca textual.

#### Critérios de aceite

- Deve ser possível concluir a inscrição apenas com o CEP residencial.
- Deve ser possível adicionar e remover os dois CEPs opcionais.
- Cada card de unidade deve exibir a distância para cada ponto válido.
- O usuário deve poder ordenar unidades pelo ponto de sua preferência ou pela menor distância entre os pontos.

### 8.3 RF-03 - Contatos multicanal

O sistema deve aceitar um ou mais telefones. Pelo menos um telefone é obrigatório.

Cada telefone deve registrar:

- número em formato E.164;
- rótulo;
- titular ou relação com a criança;
- indicador de principal;
- autorização para ligação;
- autorização para SMS;
- autorização para WhatsApp;
- status de verificação;
- prioridade de contato;
- data de consentimento ou ciência aplicável;
- data da última validação.

O backend deve suportar quantidade variável de contatos. A interface poderá sugerir até três telefones para manter a jornada simples, sem criar limite rígido no domínio.

#### Regras

- Deve existir exatamente um telefone principal.
- Não deve ser possível remover o único telefone existente.
- Telefones duplicados devem ser sinalizados.
- Telefones pertencentes a terceiros devem exigir relação e confirmação de autorização.
- Na demonstração, a verificação por OTP será simulada.

### 8.4 RF-04 - Redes sociais

A família poderá cadastrar zero ou mais perfis nas plataformas:

- Instagram;
- Facebook;
- TikTok;
- X/Twitter.

Cada perfil deve registrar:

- plataforma;
- `@handle` informado;
- identificador interno da plataforma, quando houver vinculação futura;
- status `INFORMED`, `PENDING_VERIFICATION`, `VERIFIED`, `INVALID` ou `REVOKED`;
- prioridade de contato;
- autorização para contato;
- data de autorização;
- data da última verificação.

#### Regras

- Redes sociais são opcionais e nunca podem ser o único contato.
- O MVP deve simular vinculação e verificação.
- O produto deve tratar o `@handle` como mutável.
- Integrações futuras devem preferir o identificador interno da plataforma.
- Mensagens sociais não podem expor nome da criança, vulnerabilidade, unidade ou detalhes sensíveis.
- TikTok deve permanecer um adapter simulado até existir integração empresarial compatível e aprovada.

### 8.5 RF-05 - Recomendação de unidades

O sistema deve recomendar e mapear unidades compatíveis com:

- grupamento etário;
- turno;
- processo selecionado;
- disponibilidade ou capacidade carregada;
- proximidade aos pontos informados;
- filtros territoriais;
- tipo de gestão;
- demanda histórica, claramente rotulada como histórica e anonimizada.

#### Exibição mínima do card

- nome da unidade;
- tipo de unidade;
- bairro;
- turnos disponíveis;
- grupamentos atendidos;
- distância para residência;
- distância para trabalho, se informado;
- distância para rede de apoio, se informada;
- nível histórico de demanda, sem prometer chance de vaga;
- ação para adicionar às preferências.

#### Regras

- A recomendação territorial não pode impedir a escolha livre de outra unidade válida.
- O sistema deve explicar por que uma unidade foi recomendada.
- A distância deve ser geodésica ou fornecida por serviço configurável; não inventar tempos de percurso.
- Toda distância estimada deve ser identificada como estimativa.

### 8.6 RF-06 - Preferências

A família poderá selecionar de uma a cinco unidades em ordem de preferência.

#### Regras

- Uma unidade não pode aparecer duas vezes na mesma lista para a mesma combinação de grupamento e turno.
- A ordem deve ser alterável por drag-and-drop e por controles acessíveis de mover para cima ou para baixo.
- Antes de concluir, o sistema deve destacar opções distantes, incompatíveis ou com dados incompletos.
- Alertas devem informar, não bloquear, salvo incompatibilidade objetiva.
- O sistema deve registrar a ordem exata submetida.

### 8.7 RF-07 - Motor versionado de pontuação

O sistema deve reconstruir a pontuação a partir de:

- processo/ano;
- catálogo de perguntas;
- respostas;
- confirmação da resposta;
- peso vigente;
- critérios de desempate;
- versão da regra.

#### Regras

- Uma alteração de peso deve criar nova versão, nunca reescrever resultado histórico.
- Cada resultado deve guardar entradas, versão da regra, pontos por critério, total e desempates.
- A explicação deve ser gerada a partir dos dados estruturados, não por inferência de LLM.
- Um LLM opcional poderá apenas reescrever a explicação em linguagem simples, sem alterar números.

### 8.8 RF-08 - Motor de alocação

O MVP deve implementar um algoritmo determinístico de alocação por preferências, inspirado em deferred acceptance e adaptado às regras configuradas.

#### Fluxo esperado

1. Cada inscrição concorre inicialmente à primeira preferência válida.
2. Cada unidade mantém provisoriamente as inscrições prioritárias até sua capacidade.
3. Inscrições não alocadas avançam para a próxima preferência.
4. O processo continua até não haver movimentações.
5. Cada criança mantém no máximo uma oferta provisória.

#### Invariantes obrigatórios

- Uma criança não pode ter mais de uma oferta ativa.
- Uma unidade não pode exceder sua capacidade para grupamento e turno.
- Uma inscrição não pode ser alocada em unidade fora de suas preferências.
- Maior prioridade oficial não pode ser ultrapassada por menor prioridade na mesma preferência e capacidade, salvo regra formal de desempate.
- A mesma entrada e versão de regra devem produzir a mesma saída.
- Toda decisão deve ser explicável.

#### Saídas da simulação

- total alocado;
- não alocados;
- alocações por posição da preferência;
- ocupação por unidade, grupamento e turno;
- ofertas simultâneas evitadas;
- vagas remanescentes;
- inconsistências;
- duração e versão da execução.

### 8.9 RF-09 - Comparador de cenários

O sistema deve apresentar uma comparação entre:

- estado histórico presente nos dados;
- resultado do algoritmo proposto;
- cenários de capacidade alterada.

Toda comparação deve informar que os dados são anonimizados e não constituem indicador oficial.

### 8.10 RF-10 - Painel operacional da CRE

O painel deve conter:

- inscrições por status;
- vagas e ocupação;
- convocações aguardando resposta;
- prazos vencendo;
- convocações expiradas;
- opções selecionadas que coexistem com lista de espera;
- múltiplas seleções para a mesma criança;
- inscrições com mais de cinco opções;
- falta de CEP ou contato obrigatório;
- falhas de envio por canal;
- fila pronta para nova convocação.

#### Filtros

- processo;
- CRE;
- polo;
- unidade;
- grupamento;
- turno;
- status;
- prazo;
- canal de contato.

#### Regras

- Consultas devem ser paginadas.
- Dados de contato devem aparecer mascarados por padrão.
- Exportações devem exigir permissão específica e gerar auditoria.

### 8.11 RF-11 - Convocação rastreável

Quando uma vaga for aberta, o sistema deve criar uma convocação para a próxima criança elegível.

#### Estados

```text
PENDING
QUEUED
CONTACTING
DELIVERED
AWAITING_RESPONSE
ACCEPTED
DECLINED
EXPIRED
EXTENDED
MANUAL_REVIEW
CANCELLED
```

#### Regras de prazo simuladas

- Realizar ao menos uma tentativa por dia durante três dias consecutivos, em horários diferentes.
- Permitir extensão simulada de um dia útil mediante justificativa e dentro do prazo original.
- A estratégia de canais deve ser configurável.
- Aceite, recusa ou expiração deve cancelar jobs futuros desnecessários.
- Recusa ou expiração deve disponibilizar a vaga para a próxima criança.
- Aceite deve encerrar as demais opções da mesma inscrição de forma transacional.
- Processamento deve ser idempotente para impedir convocações duplicadas.

#### Ordem padrão sugerida

1. WhatsApp principal.
2. SMS principal.
3. Ligação principal.
4. Telefones alternativos.
5. E-mail, se disponível.
6. Instagram.
7. Facebook.
8. X/Twitter.
9. TikTok simulado.

A ordem deve ser parametrizável por processo e não codificada diretamente no domínio.

### 8.12 RF-12 - Tentativas de contato

Cada tentativa deve registrar:

- convocação;
- canal;
- contato utilizado;
- destinatário mascarado;
- adapter/provedor;
- horário agendado;
- horário de processamento;
- status de envio;
- status de entrega ou leitura, quando simulado;
- código de erro;
- número de tentativas;
- resposta recebida;
- correlation ID;
- usuário ou worker responsável.

Os adapters do MVP devem suportar cenários configuráveis de sucesso, falha, entrega, leitura e resposta.

### 8.13 RF-13 - Resposta da família

O MVP deve disponibilizar uma página pública simulada, acessada por token de uso único e prazo limitado, com as ações:

- aceitar vaga;
- recusar vaga;
- solicitar extensão;
- atualizar telefones e canais, quando permitido.

O token deve ser armazenado apenas em forma de hash, expirar e tornar-se inválido após uso.

### 8.14 RF-14 - Mensagens

As mensagens devem usar templates versionados e separados por canal.

#### Requisitos

- Linguagem simples e acessível.
- Nenhuma informação sensível em SMS ou redes sociais.
- Link apenas para domínio oficial configurado.
- Identificador de protocolo, sem nome completo da criança.
- Variações de mensagem não podem alterar prazo ou regra.
- Templates devem suportar visualização antes da ativação.

Exemplo para rede social:

> A Prefeitura do Rio possui uma atualização importante sobre uma inscrição de creche vinculada a este contato. Acesse o portal oficial utilizando o protocolo informado.

### 8.15 RF-15 - Planejamento territorial

O sistema deve exibir mapa e indicadores agregados combinando:

- inscrições históricas;
- opções escolhidas;
- confirmações e listas de espera;
- unidades e coordenadas;
- CREs e microáreas;
- grupamentos e turnos;
- oferta, ocupação e vagas normalizadas;
- nascidos vivos por bairro e ano.

#### Simulador

O gestor poderá alterar, apenas em cenário temporário:

- capacidade de uma unidade;
- capacidade por grupamento;
- capacidade por turno;
- criação de uma unidade fictícia;
- distribuição territorial de vagas.

O sistema deve recalcular o resultado do cenário sem alterar dados-base.

### 8.16 RF-16 - Auditoria e histórico

Toda operação relevante deve gerar evento append-only contendo:

- ator;
- papel;
- ação;
- entidade;
- identificador da entidade;
- instante UTC;
- correlation ID;
- versão anterior e posterior, quando seguro;
- origem: interface, API, worker ou importação.

Não registrar valor completo de telefone, `@handle`, token, resposta sensível ou segredo no log.

---

## 9. Fluxos principais

### 9.1 Jornada da família

1. Iniciar inscrição de demonstração.
2. Informar dados mínimos da criança.
3. Informar CEP residencial.
4. Adicionar opcionalmente CEP de trabalho e rede de apoio.
5. Informar telefone principal e contatos alternativos.
6. Informar opcionalmente redes sociais.
7. Visualizar mapa e recomendações.
8. Selecionar e ordenar até cinco unidades.
9. Responder critérios socioeconômicos simulados.
10. Revisar pontuação explicável e preferências.
11. Submeter inscrição.
12. Consultar resultado simulado.

### 9.2 Jornada da CRE

1. Acessar painel de seu território.
2. Filtrar unidade, grupamento e turno.
3. Ver alertas de inconsistência e prazo.
4. Abrir uma vaga de demonstração.
5. Gerar convocação da próxima criança elegível.
6. Acompanhar tentativas multicanal.
7. Simular resposta da família.
8. Confirmar encerramento ou passagem da vaga à próxima criança.

### 9.3 Jornada do gestor SME

1. Selecionar processo e versão das regras.
2. Executar classificação simulada.
3. Comparar histórico e cenário proposto.
4. Alterar capacidade em um cenário isolado.
5. Reexecutar classificação.
6. Consultar impacto territorial e trilha da execução.

---

## 10. Dados e fontes

### 10.1 Repositório

```text
https://github.com/CIT-SME-RJ/dadoscreche/
```

### 10.2 Bases principais

| Fonte | Uso |
| --- | --- |
| `01_QueryA_InscricoesPorAno.csv.gz` | Inscrições, opções, criança, responsável, localização e situação |
| `02_QueryB_RespostasSocioEconomicas.csv.gz` | Respostas e confirmações socioeconômicas |
| `03_QueryC_PerguntasComDescricao.csv` | Perguntas, pesos e critérios por processo |
| `04_UnidadesEscolaresComEndereco.csv` | Cadastro de unidades e endereços |
| `Unidades_Unificadas_com_Localizacao.xlsx` | Coordenadas, CRE e microárea |
| `Parceiras*.xlsx` | Oferta, meta, alunos e vagas de unidades parceiras |
| `totalalunoscreche*.xlsx` | Ocupação das unidades públicas |
| `NascidosvivosRJ.xlsx` | Demanda potencial por bairro e ano |
| Shapefile de microáreas | Geometria territorial |

### 10.3 Regras de ingestão

- Processar arquivos grandes sem carregar todas as linhas na memória do Node.js.
- Utilizar DuckDB via `@duckdb/node-api` para consultas e transformações.
- Tratar CSV com separador `;` e UTF-8 BOM.
- Ler `.csv.gz` diretamente quando suportado.
- Preservar CEP e códigos como texto.
- Normalizar códigos com zeros à esquerda antes de junções.
- Tratar `NULL`, strings vazias e acentuação de forma explícita.
- Registrar origem, hash, data e versão de cada importação.
- Validar schema, contagem de linhas e chaves antes de publicar dados tratados.
- Gerar tabelas curadas ou Parquet para uso analítico.
- Não substituir silenciosamente arquivos ou versões já importadas.

### 10.4 Validações conhecidas

- A base de unidades não deve perder a primeira linha por ausência de cabeçalho.
- `Cancelado na confirmacao` deve ser tratado sem cedilha e sem til conforme a origem.
- Existem registros com opção maior que cinco; devem ser sinalizados.
- As regras mudam por ano e não podem ser comparadas sem versionamento.
- Ausência de timestamp de status impede calcular tempo histórico real de convocação.

---

## 11. Modelo de dados canônico

Entidades mínimas:

| Entidade | Finalidade |
| --- | --- |
| `Process` | Processo seletivo e datas de referência |
| `RuleVersion` | Versão imutável de regras, pesos e desempates |
| `Criterion` | Pergunta e regra aplicável |
| `Unit` | Unidade, endereço, gestão, CRE, microárea e coordenadas |
| `UnitCapacity` | Capacidade por processo, unidade, grupamento e turno |
| `Child` | Identificador anônimo e dados mínimos da criança |
| `Guardian` | Identificador anônimo do responsável |
| `LocationAnchor` | CEP residencial, trabalho ou rede de apoio |
| `ContactPoint` | Telefone, e-mail ou perfil social |
| `Application` | Inscrição da criança no processo |
| `Preference` | Unidade escolhida e ordem |
| `CriterionResponse` | Resposta e confirmação |
| `ScoreResult` | Pontuação calculada e explicação estruturada |
| `AllocationRun` | Execução versionada do matching |
| `Allocation` | Resultado por inscrição |
| `Convocation` | Oferta e prazo de resposta |
| `ContactAttempt` | Tentativa por canal |
| `StatusEvent` | Transição temporal de status |
| `AuditEvent` | Operação relevante para auditoria |
| `MessageTemplate` | Template versionado por canal |

### 11.1 Restrições de banco

- Unique constraint para uma preferência por posição em cada inscrição.
- Unique constraint para uma unidade por inscrição/grupamento/turno.
- Partial unique index garantindo no máximo uma alocação ativa por criança/processo.
- Controle transacional de capacidade.
- Foreign keys obrigatórias nas entidades de negócio.
- Índices por processo, CRE, unidade, status, prazo e criança.
- Particionamento por processo/ano para tabelas de grande volume quando necessário.

---

## 12. Arquitetura técnica

### 12.1 Stack obrigatória

| Camada | Tecnologia |
| --- | --- |
| Linguagem | TypeScript strict |
| Runtime | Node.js LTS |
| Front-end | Next.js |
| API | NestJS |
| Banco transacional | PostgreSQL |
| ORM | Prisma |
| Processamento analítico | `@duckdb/node-api` |
| Fila | BullMQ |
| Broker/cache | Redis |
| Mapas | MapLibre GL JS ou Leaflet, conforme `/docs/DESIGN.md` e compatibilidade |
| Validação | Zod ou DTOs validados do NestJS; manter schemas compartilhados |
| Testes unitários | Vitest |
| Testes E2E | Playwright |
| Monorepo | pnpm workspaces e Turborepo |
| Observabilidade | OpenTelemetry, logs JSON e métricas Prometheus-compatible |

Não fixar versões neste documento. Utilizar versões estáveis e compatíveis no momento da implementação, com Node.js em versão LTS.

### 12.2 Estrutura sugerida

```text
/
  apps/
    web/                 # Next.js
    api/                 # NestJS HTTP API
    worker/              # Workers BullMQ
  packages/
    domain/              # Entidades e regras puras
    matching-engine/     # Pontuação e alocação
    schemas/             # Contratos e validação compartilhada
    data-pipeline/       # ETL TypeScript + DuckDB
    channel-adapters/    # Mocks e contratos de mensageria
    ui/                  # Implementação dos componentes do DESIGN.md
    config/              # Configurações compartilhadas
  prisma/
    schema.prisma
    migrations/
    seed.ts
  docs/
    DESIGN.md
    DECISIONS.md
    DATA_DICTIONARY.md
    SECURITY.md
    RUNBOOK.md
  PRD.md
```

### 12.3 Componentes

1. **Web:** jornada da família, dashboards, mapas e simulações.
2. **API:** autenticação simulada, regras de acesso, comandos e consultas.
3. **Worker:** convocações, prazos, retries, ETL e cálculos longos.
4. **PostgreSQL:** dados transacionais, regras, eventos e resultados.
5. **DuckDB:** transformação local/analítica dos arquivos históricos.
6. **Redis/BullMQ:** filas, jobs atrasados, retries e cache.
7. **Adapters:** interfaces isolando WhatsApp, SMS, e-mail e redes sociais.

### 12.4 APIs mínimas

```text
POST   /applications
GET    /applications/:id
PATCH  /applications/:id
POST   /applications/:id/location-anchors
POST   /applications/:id/contact-points
GET    /units/recommendations
PUT    /applications/:id/preferences
POST   /score-runs
GET    /score-runs/:id
POST   /allocation-runs
GET    /allocation-runs/:id
GET    /dashboards/operations
GET    /dashboards/planning
POST   /convocations
GET    /convocations/:id
POST   /convocations/:id/accept
POST   /convocations/:id/decline
POST   /convocations/:id/extend
GET    /audit-events
GET    /health/live
GET    /health/ready
```

Todos os endpoints de escrita devem aceitar ou gerar chave de idempotência quando houver risco de repetição.

---

## 13. Segurança da informação e privacidade

### 13.1 Referenciais

A implementação deve buscar conformidade proporcional com:

- OWASP ASVS 5.0, preferencialmente nível 2 para uma futura versão com dados pessoais;
- OWASP Top 10 2025;
- OWASP API Security Top 10 2023;
- LGPD e orientações da ANPD aplicáveis;
- melhor interesse de crianças e adolescentes;
- políticas internas de segurança e privacidade da Prefeitura/SME.

O MVP não é uma declaração de conformidade jurídica. Bases legais, retenção e integrações reais devem ser validadas pelo encarregado de dados e pelas áreas jurídica e de segurança da SME.

### 13.2 Classificação e minimização

- Tratar telefones, e-mails, perfis sociais, CEPs e vínculos familiares como dados pessoais.
- Tratar informações de vulnerabilidade, deficiência e saúde como dados de maior sensibilidade.
- Coletar apenas campos necessários à inscrição, classificação ou contato.
- Não reutilizar contatos para marketing ou finalidade incompatível.
- Não utilizar dados reais no MVP.
- Definir retenção configurável antes de produção.

### 13.3 Autenticação e autorização

- Implementar RBAC no backend; nunca depender apenas de ocultação na interface.
- Aplicar menor privilégio e escopo territorial.
- Preparar integração futura com identidade corporativa e MFA para operadores.
- No MVP, autenticação simulada deve ser claramente identificada e não reutilizada em produção.
- Sessões devem usar cookies `HttpOnly`, `Secure` e `SameSite` apropriado.
- Operações críticas devem exigir reautorização ou permissão elevada quando aplicável.

### 13.4 Proteção de dados

- TLS obrigatório fora do ambiente local.
- Criptografia em repouso no banco e backups em produção.
- Criptografar em nível de aplicação os valores completos de telefone e perfis sociais quando viável.
- Exibir contatos mascarados por padrão.
- Armazenar tokens de resposta somente como hash.
- Proibir PII em logs, traces, métricas, URLs e mensagens de erro.
- Segredos apenas em secret manager ou variáveis protegidas.
- Nunca versionar `.env`, chaves ou dumps.

### 13.5 Segurança de aplicação

- Validar toda entrada no limite da API.
- Usar consultas parametrizadas via Prisma/DuckDB.
- Implementar proteção contra XSS, CSRF, SQL injection, SSRF, path traversal e prototype pollution.
- Configurar CSP, HSTS, `X-Content-Type-Options`, política de referrer e permissões do navegador.
- Limitar tamanho de payload e importação.
- Aplicar rate limiting por IP, usuário e endpoint sensível.
- Utilizar CAPTCHA ou controle antifraude configurável no fluxo público futuro.
- Não expor stack traces em produção.
- Gerar IDs não sequenciais para referências públicas.

### 13.6 Mensageria e webhooks

- Validar assinatura de webhooks futuros.
- Impedir replay por timestamp, nonce e idempotência.
- Aplicar timeout, retry com backoff, circuit breaker e dead-letter handling.
- Não incluir informação sensível em mensagem social, SMS ou push.
- Links de resposta devem expirar, ser de uso único e utilizar domínio permitido.
- Manter allowlist de providers e destinos de callback.

### 13.7 Supply chain e CI/CD

- Usar lockfile versionado.
- Ativar secret scanning, SAST e análise de dependências.
- Bloquear merge com vulnerabilidade crítica conhecida sem exceção aprovada.
- Gerar SBOM em builds de release.
- Fixar actions de CI por versão ou commit confiável.
- Executar build em ambiente limpo e reprodutível.
- Utilizar imagens mínimas e usuário não-root em containers.

### 13.8 Auditoria

- Logs de auditoria devem ser append-only.
- Alterações em regras, capacidade, templates e permissões devem registrar autor e versão.
- Exportações de dados devem ser auditadas.
- Acesso de administrador não deve eliminar rastreabilidade.

---

## 14. Estratégia de testes

### 14.1 Testes unitários

Cobrir:

- cálculo de grupamento;
- normalização de CEP, telefone e códigos;
- pontuação por processo/ano;
- critérios de desempate;
- invariantes do matching;
- máquina de estados da convocação;
- expiração e extensão de prazo;
- mascaramento de dados;
- templates de mensagens;
- idempotência.

Meta recomendada:

- mínimo de 90% de cobertura nos pacotes `domain` e `matching-engine`;
- mínimo de 80% no projeto, sem usar cobertura como substituto de qualidade.

### 14.2 Testes baseados em propriedades

O motor de alocação deve ser testado com entradas geradas para provar:

- nunca mais de uma oferta ativa por criança;
- nunca exceder capacidade;
- nunca alocar fora das preferências;
- determinismo;
- ausência de perda ou duplicação de inscrições;
- terminação do algoritmo.

### 14.3 Testes de integração

- API com PostgreSQL real em container de teste.
- Prisma migrations e rollback quando suportado.
- BullMQ com Redis real em container.
- worker processando jobs atrasados com relógio controlado.
- ETL lendo amostras de todos os formatos.
- transação de aceite cancelando as demais opções.
- reprocessamento do mesmo evento sem duplicação.

### 14.4 Testes de contrato

Cada adapter de canal deve obedecer a uma interface comum:

```ts
interface ChannelAdapter {
  send(command: SendMessageCommand): Promise<SendMessageResult>;
  getStatus?(providerMessageId: string): Promise<MessageStatus>;
}
```

Mocks e implementações futuras devem passar pelo mesmo conjunto de contract tests.

### 14.5 Testes E2E

Cenários obrigatórios:

1. Inscrição apenas com CEP residencial e telefone principal.
2. Inscrição com três CEPs, telefones alternativos e redes sociais.
3. Seleção e reordenação de cinco unidades.
4. Cálculo explicável da pontuação.
5. Execução de matching sem oferta duplicada.
6. Convocação aceita no primeiro canal.
7. Falha em canais primários e entrega simulada em rede social.
8. Recusa e passagem da vaga à próxima criança.
9. Expiração após três dias e extensão de um dia.
10. Operador sem permissão tentando acessar outra CRE.

### 14.6 Testes de segurança

- Testes de autorização por objeto e por território.
- Tentativas de IDOR/BOLA nos endpoints.
- XSS em campos de rótulo, mensagem e `@handle`.
- Injection em filtros e importações.
- CSRF em ações públicas e administrativas.
- Reuso de token expirado ou consumido.
- Enumeração de inscrições.
- Rate limiting.
- Vazamento de PII em logs e erros.
- Dependency scan e secret scan no CI.

### 14.7 Testes de acessibilidade

- Navegação integral por teclado.
- Ordem de foco previsível.
- Labels e mensagens de erro associados aos campos.
- Alternativa textual ao mapa.
- Contraste e estados conforme `/docs/DESIGN.md`.
- Testes automáticos e revisão manual visando WCAG 2.2 AA.

### 14.8 Gates de CI

Uma mudança não pode ser considerada pronta se falhar em:

```text
lint
typecheck
unit tests
integration tests relevantes
security scans
build
E2E smoke tests
```

---

## 15. Escalabilidade e desempenho

### 15.1 Princípios

- Separar operações transacionais de consultas analíticas.
- Evitar carregar milhões de registros na memória do Node.js.
- Executar ETL e matching pesado em worker, nunca no request HTTP.
- Utilizar paginação por cursor para listas extensas.
- Utilizar agregações pré-calculadas para dashboards.
- Projetar workers horizontalmente escaláveis e idempotentes.
- Manter a aplicação stateless quando possível.

### 15.2 Capacidade de referência

O sistema deve ser testado com pelo menos:

- 100 mil inscrições em um processo simulado;
- 500 mil preferências;
- 5 milhões de respostas socioeconômicas;
- 2 mil unidades;
- múltiplas execuções de matching e cenários preservadas historicamente.

Esses valores são metas técnicas de teste, não projeções oficiais de demanda.

### 15.3 Metas iniciais de desempenho

| Operação | Meta inicial |
| --- | --- |
| Consultas comuns da API | p95 abaixo de 500 ms, sem dependência externa |
| Escritas comuns | p95 abaixo de 1 s |
| Carregamento inicial do dashboard | até 2 s com agregados e cache |
| Busca/recomendação no mapa | p95 abaixo de 1 s após geocodificação |
| Execução de matching com 100 mil inscrições | até 5 minutos em worker de referência a documentar |
| Processamento de job de contato | início dentro da tolerância operacional configurada |

As metas devem ser validadas por benchmark no ambiente disponível e registradas em `/docs/RUNBOOK.md`.

### 15.4 Banco e consultas

- Índices compostos alinhados aos filtros principais.
- Particionar eventos e grandes tabelas por processo/ano quando necessário.
- Utilizar PostGIS se disponível para consultas geoespaciais.
- Utilizar materialized views ou tabelas agregadas para dashboards.
- Aplicar cache Redis com invalidação explícita.
- Evitar `OFFSET` alto; preferir cursor.
- Observar N+1 e limitar includes do ORM.

### 15.5 Filas

- Jobs devem ter idempotency key.
- Configurar retries com backoff e jitter.
- Separar filas de convocação, ETL e matching.
- Definir concorrência por fila.
- Implementar dead-letter ou estado de falha terminal.
- Monitorar lag, jobs ativos, falhas e tempo de processamento.
- Permitir escala horizontal dos workers.

### 15.6 Resiliência

- Timeouts em toda chamada externa.
- Circuit breaker por provider.
- Graceful shutdown dos workers.
- Readiness deve falhar quando dependências críticas estiverem indisponíveis.
- Operações críticas devem ser transacionais.
- Backups e restauração devem ser testados antes de produção.
- RPO e RTO de produção devem ser definidos com a SME; não assumir valores no MVP.

---

## 16. Observabilidade e operação

### 16.1 Logs

- JSON estruturado.
- Timestamp UTC.
- Correlation ID e request ID.
- Nível, serviço, operação e duração.
- Nenhum dado pessoal completo.
- Redação automática de campos sensíveis.

### 16.2 Métricas

- latência, throughput e erro por endpoint;
- duração de matching;
- inscrições processadas por segundo;
- ocupação e conexões do banco;
- cache hit rate;
- queue lag;
- jobs falhos e retries;
- tentativas por canal;
- falhas por adapter;
- convocações por estado;
- tempo simulado até resposta.

### 16.3 Tracing

Usar OpenTelemetry para correlacionar:

```text
requisição -> API -> banco -> fila -> worker -> adapter -> evento
```

Spans não devem conter telefone, CEP completo, `@handle`, respostas socioeconômicas ou tokens.

### 16.4 Health checks

- `/health/live`: processo está vivo.
- `/health/ready`: banco, Redis e configurações mínimas disponíveis.
- Dependências opcionais simuladas não devem indisponibilizar toda a aplicação.

---

## 17. Acessibilidade e experiência

- Aplicação mobile-first e responsiva.
- Compatível com teclado e leitores de tela.
- Não depender apenas de cor para status.
- Oferecer lista equivalente ao mapa.
- Usar linguagem simples e mensagens orientadas à ação.
- Explicar termos como grupamento, turno e lista de espera.
- Preservar progresso do formulário.
- Confirmar ações irreversíveis.
- Formulários devem ter validação inline e resumo de erros.
- Seguir integralmente `/docs/DESIGN.md`.

---

## 18. Indicadores do MVP

### 18.1 Produto

- percentual de jornadas concluídas;
- unidades adicionadas por ponto de referência;
- distribuição por posição de preferência;
- inscrições com pelo menos um telefone alternativo;
- inscrições com canal social opcional;
- alertas territoriais apresentados e revisados.

### 18.2 Classificação

- ofertas simultâneas por criança: meta zero;
- capacidade excedida: meta zero;
- percentual alocado nas três primeiras preferências;
- inscrições não alocadas;
- tempo de execução;
- decisões com explicação disponível: meta 100%.

### 18.3 Convocação simulada

- tentativas por convocação;
- taxa de entrega simulada por canal;
- tempo até resposta;
- vagas liberadas após recusa/expiração;
- jobs duplicados: meta zero;
- tentativas sem trilha de auditoria: meta zero.

---

## 19. Roadmap de implementação

### Fase 0 - Fundação

- Ler `PRD.md` e `/docs/DESIGN.md`.
- Criar monorepo e configurações compartilhadas.
- Configurar TypeScript strict, lint, testes e CI.
- Criar Docker Compose para PostgreSQL e Redis.
- Definir ADRs iniciais em `/docs/DECISIONS.md`.

### Fase 1 - Dados

- Implementar ingestão TypeScript com DuckDB.
- Criar schema canônico e migrations.
- Normalizar unidades, regras e amostras de inscrições.
- Criar dados sintéticos para status e contatos.
- Produzir relatório de qualidade de dados.

### Fase 2 - Jornada da família

- Inscrição em etapas.
- Um a três CEPs.
- Telefones e redes sociais.
- Mapa e recomendação.
- Preferências ordenadas.

### Fase 3 - Classificação

- Motor de pontuação versionado.
- Matching determinístico.
- Testes de invariantes.
- Comparação de cenários.

### Fase 4 - Operação e convocação

- Painel CRE.
- Máquina de estados.
- BullMQ e workers.
- Adapters simulados.
- Página de resposta da família.
- Auditoria.

### Fase 5 - Planejamento e hardening

- Mapa territorial.
- Simulador de capacidade.
- Observabilidade.
- Testes de carga, segurança e acessibilidade.
- Runbook e documentação final.

---

## 20. Definition of Done

Uma funcionalidade só está concluída quando:

- atende aos critérios de aceite;
- respeita `/docs/DESIGN.md`;
- possui validação de entrada e autorização no backend;
- inclui testes adequados;
- não introduz erro de lint, tipo ou build;
- não registra PII em logs;
- possui estados de loading, vazio, erro e sucesso;
- funciona por teclado quando aplicável;
- possui observabilidade proporcional;
- atualiza documentação ou ADR quando altera decisão arquitetural.

O MVP está concluído quando:

- a jornada completa da família funciona com dados sintéticos;
- o matching respeita todos os invariantes;
- a convocação multicanal simulada funciona do início ao encerramento;
- o painel exibe filas, alertas e prazos;
- o mapa territorial e um cenário de capacidade são demonstráveis;
- todos os gates de CI passam;
- não existem vulnerabilidades críticas conhecidas abertas;
- README e instruções de execução estão atualizados.

---

## 21. Riscos e questões em aberto

| Tema | Risco ou decisão pendente |
| --- | --- |
| Desempates | Confirmar regras completas e sua ordem oficial por processo |
| Capacidade | Arquivos públicos e parceiros têm estruturas heterogêneas |
| Geocodificação | Definir provider e política de cache para CEPs |
| Distância | Definir se produção usará distância geodésica ou rota viária |
| Autenticação | Definir identidade oficial para famílias e operadores |
| Social | APIs podem impedir contato iniciado apenas pelo `@handle` |
| TikTok | Não há adapter empresarial geral confirmado para envio de DM |
| Privacidade | Validar base legal, consentimentos, retenção e contatos de terceiros |
| Integração | Definir APIs do sistema de matrícula, RMI e canais oficiais |
| SLA | Confirmar calendário, dias úteis, feriados e regras de extensão |
| Produção | Definir infraestrutura, volumes, RPO, RTO e suporte operacional |

Essas questões não bloqueiam o MVP quando puderem ser representadas por configuração, mock ou dado sintético claramente identificado.

---

## 22. Referências

- Repositório SME-Rio: https://github.com/CIT-SME-RJ/dadoscreche/
- Dicionário de dados: https://github.com/CIT-SME-RJ/dadoscreche/blob/main/Bases%20IC_%20ClassificadoseFila/README_dicionario_dados.md
- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP API Security: https://owasp.org/www-project-api-security/
- ANPD: https://www.gov.br/anpd/
- DuckDB Node.js Client: https://duckdb.org/docs/current/clients/node_neo/overview
- BullMQ: https://docs.bullmq.io/
- Instagram Messaging: https://developers.facebook.com/documentation/business-messaging/instagram-messaging/
- X Direct Messages API: https://docs.x.com/x-api/direct-messages/manage/introduction
- TikTok for Developers: https://developers.tiktok.com/
