/**
 * Gera o catalogo de criterios de pontuacao consumido pelo seed (ADR-0037).
 *
 * A regua vem da Query C: 13 perguntas por processo, com o peso vigente e a
 * marca de criterio de desempate. E dado oficial da SME, nao sintetico.
 *
 * Os cinco processos entram inteiros, e nao apenas o mais recente, porque
 * PRD 8.7 exige reconstruir a pontuacao por processo/ano: um resultado de 2022
 * so pode ser reproduzido com a regua de 2022.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DuckDBInstance } from '@duckdb/node-api';

const here = dirname(fileURLToPath(import.meta.url));
const CURATED = join(here, '../../../data/curated');
const DESTINO = join(here, '../../database/src/criteria.json');

const versoes = readdirSync(CURATED).sort();
const ultima = versoes.at(-1);
if (ultima === undefined) {
  throw new Error(
    `Nenhuma importacao em ${CURATED}. Rode "pnpm --filter @match/data-pipeline ingest".`,
  );
}

const c = await (await DuckDBInstance.create(':memory:')).connect();
const linhas = await (
  await c.run(`
    SELECT ano, prm_id, perg_id, ich_perg_id, pergunta_texto, ordem, pontuacao, criterio_desempate
    FROM read_parquet('${join(CURATED, ultima, 'catalogo_perguntas.parquet')}')
    ORDER BY ano, ordem
  `)
).getRowObjectsJson();

const porAno = new Map();
for (const linha of linhas) {
  const ano = Number(linha.ano);
  if (!porAno.has(ano)) porAno.set(ano, []);
  porAno.get(ano).push({
    // `perg_id` e a chave estavel entre anos; `ich_perg_id` muda a cada processo
    // e e o que liga as respostas historicas (PRD 10.4).
    code: Number(linha.perg_id),
    processQuestionId: Number(linha.ich_perg_id),
    text: linha.pergunta_texto,
    order: Number(linha.ordem),
    points: Number(linha.pontuacao),
    // PRD 8.7 trata desempate a parte da pontuacao. Na origem, `criterio = Sim`
    // equivale exatamente a `pontuacao = 0`.
    isTiebreak: linha.criterio_desempate === 'Sim',
  });
}

const processes = [...porAno.entries()]
  .sort(([a], [b]) => a - b)
  .map(([year, criteria]) => ({
    year,
    prmId: Number(linhas.find((l) => Number(l.ano) === year).prm_id),
    totalPoints: criteria.reduce((soma, item) => soma + item.points, 0),
    criteria,
  }));

writeFileSync(
  DESTINO,
  `${JSON.stringify(
    {
      importVersion: ultima,
      generatedFrom: 'cur_catalogo_perguntas (Query C): régua oficial de 2021 a 2025',
      processes,
    },
    null,
    2,
  )}\n`,
);
console.log(
  `${processes.length} processos escritos em ${DESTINO}: ` +
    processes.map((p) => `${p.year}=${p.totalPoints}pts`).join(', '),
);
