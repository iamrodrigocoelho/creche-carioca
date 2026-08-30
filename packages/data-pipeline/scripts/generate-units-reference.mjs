/**
 * Gera a referencia de unidades consumida pelo seed do banco (ADR-0034).
 *
 * A Fase 3 publica Parquet em `data/curated/`, que nao e versionado, e o CI nao
 * tem os datasets. Sem este artefato, ou o banco ficaria sem unidades no CI, ou
 * existiriam dois caminhos de dados — um real e um sintetico — e um erro de
 * mapeamento no caminho real nao apareceria nos testes.
 *
 * Inclui apenas as unidades que aparecem nas inscricoes de 2021 a 2025. As
 * demais sao escolas municipais que nao ofertam creche; nao ha lista oficial de
 * quem oferta em 2026, e o historico e o melhor indicio disponivel.
 *
 * A demanda historica e pre-calculada aqui: agregar 837 mil linhas a cada
 * consulta seria desperdicio, e o numero nao muda entre importacoes.
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DuckDBInstance } from '@duckdb/node-api';

const here = dirname(fileURLToPath(import.meta.url));
const CURATED = join(here, '../../../data/curated');
const DESTINO = join(here, '../../database/src/units.json');

const versoes = readdirSync(CURATED).sort();
const ultima = versoes.at(-1);
if (ultima === undefined) {
  throw new Error(
    `Nenhuma importacao em ${CURATED}. Rode "pnpm --filter @match/data-pipeline ingest".`,
  );
}
const unidades = join(CURATED, ultima, 'unidades.parquet');
const inscricoes = join(CURATED, ultima, 'inscricoes.parquet');

const c = await (await DuckDBInstance.create(':memory:')).connect();

/**
 * Faixas de demanda por quartil da propria distribuicao.
 *
 * Rotulos relativos, e nao absolutos, porque PRD 8.5 proibe prometer chance de
 * vaga: "demanda alta" diz que muita gente pediu aquela unidade, nao que a
 * pessoa nao sera chamada.
 */
const linhas = await (
  await c.run(`
    WITH demanda AS (
      SELECT
        unidade_codigo,
        count(*)                        AS inscricoes,
        count(DISTINCT aluno_anon)      AS criancas,
        count(DISTINCT ano)             AS anos,
        list_sort(array_agg(DISTINCT grupamento) FILTER (WHERE grupamento IS NOT NULL)) AS grupamentos,
        list_sort(array_agg(DISTINCT horario) FILTER (WHERE horario IS NOT NULL))       AS turnos
      FROM read_parquet('${inscricoes}')
      WHERE unidade_codigo IS NOT NULL
      GROUP BY unidade_codigo
    ),
    faixas AS (
      SELECT *, ntile(4) OVER (ORDER BY inscricoes) AS quartil FROM demanda
    )
    SELECT
      u.unidade_codigo,
      u.nome,
      u.tipo,
      u.bairro,
      u.cep,
      u.cre,
      u.microarea,
      u.latitude,
      u.longitude,
      f.inscricoes,
      f.criancas,
      f.anos,
      f.grupamentos,
      f.turnos,
      CASE f.quartil WHEN 1 THEN 'BAIXA' WHEN 2 THEN 'MEDIA' WHEN 3 THEN 'ALTA' ELSE 'MUITO_ALTA' END AS demanda
    FROM faixas f
    JOIN read_parquet('${unidades}') u USING (unidade_codigo)
    ORDER BY u.unidade_codigo
  `)
).getRowObjectsJson();

const referencia = {
  importVersion: ultima,
  generatedFrom: 'cur_unidades juntado a demanda historica de cur_inscricoes (2021-2025)',
  units: linhas.map((linha) => ({
    code: linha.unidade_codigo,
    name: linha.nome,
    type: linha.tipo ?? null,
    neighborhood: linha.bairro ?? null,
    cep: linha.cep ?? null,
    cre: linha.cre === null ? null : Number(linha.cre),
    microarea: linha.microarea ?? null,
    latitude: linha.latitude === null ? null : Number(linha.latitude),
    longitude: linha.longitude === null ? null : Number(linha.longitude),
    // Grupamentos e turnos observados no historico, e nao oferta declarada de
    // 2026 — a interface precisa dizer isso (PRD 8.5).
    historicalAgeGroups: linha.grupamentos ?? [],
    historicalShifts: linha.turnos ?? [],
    historicalApplications: Number(linha.inscricoes),
    historicalChildren: Number(linha.criancas),
    historicalYears: Number(linha.anos),
    demandLevel: linha.demanda,
  })),
};

// Uma unidade por linha: o arquivo fica bem menor que indentado e ainda assim
// o diff mostra exatamente quais unidades mudaram.
const corpo = [
  '{',
  `  "importVersion": ${JSON.stringify(referencia.importVersion)},`,
  `  "generatedFrom": ${JSON.stringify(referencia.generatedFrom)},`,
  '  "units": [',
  referencia.units.map((unit) => `    ${JSON.stringify(unit)}`).join(',\n'),
  '  ]',
  '}',
].join('\n');
writeFileSync(DESTINO, `${corpo}\n`);
const semCoordenada = referencia.units.filter((u) => u.latitude === null).length;
console.log(
  `${referencia.units.length} unidades escritas em ${DESTINO} (${semCoordenada} sem coordenada)`,
);
