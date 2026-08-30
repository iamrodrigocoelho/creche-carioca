# Publicação estática (Hostinger)

Esta branch (`static-deploy`) gera uma versão do Match Perfeito que roda
**inteiramente no navegador**: sem servidor Node, sem API e sem PostgreSQL. Serve
para publicar a demonstração em hospedagem de arquivos, como a Hostinger.

É a mesma base de código da `main`, com um modo ligado por variável de ambiente
(ADR-0027) — não é um fork.

## Gerar o pacote

```bash
pnpm install
pnpm build:static
```

A saída fica em `apps/web/out/`. São cerca de 1,4 MB, incluindo os logotipos e a
referência de geocodificação.

## Publicar

Para subir pelo gerenciador de arquivos da Hostinger, empacote a saída:

```bash
cd apps/web/out && zip -r ../../../match-perfeito-estatico.zip . && cd -
```

O `zip -r ... .` inclui o `.htaccess`; conferir isso vale o segundo que leva
(`unzip -l match-perfeito-estatico.zip | grep htaccess`).

Envie **todo o conteúdo** de `apps/web/out/` para a pasta pública do domínio
(`public_html/` na Hostinger). Inclua o `.htaccess` — ele é gerado junto e é o que
aplica os cabeçalhos de segurança que, na versão com servidor, o Next aplicava.

```
public_html/
  .htaccess
  index.html
  404.html
  inscricao/index.html
  sobre/index.html
  _next/...
  img/...
```

Arquivos que começam com ponto costumam ficar ocultos no gerenciador de arquivos
da Hostinger e em clientes de FTP. Se o `.htaccess` não aparecer, ligue a exibição
de arquivos ocultos — publicar sem ele derruba os cabeçalhos de segurança.

A versão está configurada para a **raiz do domínio**. Para publicar numa subpasta,
é preciso definir `basePath` e `assetPrefix` em `apps/web/next.config.mjs`; sem
isso, CSS, imagens e navegação quebram.

## O que funciona

Toda a jornada das Fases 1 a 4:

- cálculo do grupamento etário, com a explicação passo a passo;
- pontos de referência por CEP, geocodificados contra os CEPs reais das unidades
  escolares, com a margem de erro declarada;
- as regras de posição, o CEP de residência obrigatório e a sinalização de CEP
  repetido.

As regras não são reimplementadas: vêm de `@match/domain` e `@match/geo`, os
mesmos módulos que a API usa. `apps/web/src/lib/static-backend.ts` apenas troca o
PostgreSQL por `localStorage`.

## O que se perde

Isto não é uma limitação contornável — é o que significa não ter servidor:

| Recurso               | Situação                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| Trilha de auditoria   | Não existe. Nada é registrado.                                                                      |
| Validação no servidor | Não existe. O mesmo schema Zod roda no cliente, mas quem controla o navegador controla o resultado. |
| Rate limiting         | Não existe.                                                                                         |
| Dados compartilhados  | Não existem. Cada visitante vê apenas o que digitou no próprio dispositivo.                         |
| Idempotência          | Sem efeito. Não há requisição a repetir.                                                            |

Os dados ficam em `localStorage`, sob a chave `match-perfeito:static:v1`, e a
página de inscrição avisa isso e oferece um botão para apagá-los.

**Não use esta versão para coletar dados reais.** Ela é uma demonstração, e o PRD
§1.2 proíbe apresentar dado sintético como oficial.

## Verificar antes de publicar

```bash
pnpm e2e:static
```

Sobe um servidor de arquivos burro sobre `out/` — o equivalente ao que a Hostinger
oferece — e percorre a jornada com a API desligada. Os testes também bloqueiam
qualquer requisição que saia da origem, então uma chamada de rede acidental
aparece como falha, não como lentidão.

## Manter atualizado

A `static-deploy` é a `main` mais os arquivos deste modo. A cada fase nova:

```bash
git checkout static-deploy
git rebase origin/main
pnpm build:static && pnpm e2e:static
```

O modo estático é aditivo — arquivos novos e um punhado de condicionais — então o
rebase tende a não conflitar.
