/**
 * Gera as fixtures do pipeline a partir dos datasets reais.
 *
 * As fixtures sao versionadas e os datasets nao, entao este script so precisa
 * rodar quando a origem mudar. Ele preserva de proposito os casos-limite que o
 * relatorio de qualidade deve encontrar: opcao > 5, coordenada fora do Rio,
 * unidade sem endereco, unidade sem localizacao e pontuacao que varia por ano.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DuckDBInstance } from '@duckdb/node-api';

const here = dirname(fileURLToPath(import.meta.url));
const RAW = join(here, '../../../data/raw');
const OUT = join(here, '..', 'test', 'fixtures');
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

const c = await (await DuckDBInstance.create(':memory:')).connect();
await c.run('INSTALL excel; LOAD excel; INSTALL spatial; LOAD spatial;');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'oferecimentos'), { recursive: true });
mkdirSync(join(OUT, 'microareas'), { recursive: true });

const qa = `read_csv('${RAW}/01_QueryA_InscricoesPorAno.csv.gz', delim=';', header=true, all_varchar=true)`;
const qb = `read_csv('${RAW}/02_QueryB_RespostasSocioEconomicas.csv.gz', delim=';', header=true, all_varchar=true)`;
const qc = `read_csv('${RAW}/03_QueryC_PerguntasComDescricao.csv', delim=';', header=true, all_varchar=true)`;
const qd = `read_csv('${RAW}/04_UnidadesEscolaresComEndereco.csv', delim=';', header=false, all_varchar=true)`;
const ug = `read_xlsx('${RAW}/oferecimentos/Unidades_Unificadas_com_Localizacao.xlsx', sheet='Unidades_Unificadas', all_varchar=true)`;

// Amostra de inscricoes: casos-limite primeiro, completada ate 200 linhas.
await c.run(`CREATE TABLE amostra_qa AS
  WITH marcadas AS (
    SELECT *, CASE
      WHEN TRY_CAST(opcao AS INTEGER) > 5 THEN 0
      WHEN CEP IS NULL OR trim(CEP) = '' THEN 1
      WHEN situacao = 'Cancelado na confirmacao' THEN 2
      WHEN length(trim(unidade)) = 5 THEN 3
      ELSE 4 END AS prioridade
    FROM ${qa})
  SELECT * EXCLUDE (prioridade) FROM (
    -- Ordem total: (ano, prm_id, plm_id, ipl_id, opcao) e a chave da Query A.
    -- Sem isso a amostra muda a cada regeracao e o teste de nao-regressao
    -- passa a depender de sorte.
    SELECT *, row_number() OVER (
      PARTITION BY prioridade
      ORDER BY ano, prm_id, plm_id, ipl_id, opcao
    ) AS rn FROM marcadas)
  WHERE (prioridade <= 3 AND rn <= 20) OR (prioridade = 4 AND rn <= 120)`);

await c.run(`CREATE TABLE amostra_qb AS
  SELECT b.* FROM ${qb} b
  JOIN (SELECT DISTINCT prm_id, plm_id, ipl_id FROM amostra_qa) k
    ON b.prm_id = k.prm_id AND b.plm_id = k.plm_id AND b.ipl_id = k.ipl_id`);

// Catalogo inteiro: 65 linhas, e ja contem a pontuacao que muda entre anos.
await c.run(`CREATE TABLE amostra_qc AS SELECT * FROM ${qc}`);

const codigos = `(SELECT DISTINCT lpad(trim(unidade), CASE WHEN length(trim(unidade)) <= 5 THEN 5 ELSE 7 END, '0') AS cod FROM amostra_qa)`;
const padUg = `lpad(trim(DESIGNACAO), CASE WHEN length(trim(DESIGNACAO)) <= 5 THEN 5 ELSE 7 END, '0')`;
const padQd = `lpad(trim(column1), CASE WHEN length(trim(column1)) <= 5 THEN 5 ELSE 7 END, '0')`;

// Unidades: as citadas na amostra, mais uma sem endereco e uma fora do Rio.
await c.run(`CREATE TABLE amostra_qd AS
  WITH citadas AS (
    SELECT * FROM ${qd} WHERE ${padQd} IN (SELECT cod FROM ${codigos})),
  fora_do_rio AS (
    SELECT * FROM ${qd} WHERE ${padQd} IN (
      SELECT ${padUg} FROM ${ug}
      WHERE TRY_CAST(LATITUDE AS DOUBLE) NOT BETWEEN -23.1 AND -22.7
         OR TRY_CAST(LONGITUDE AS DOUBLE) NOT BETWEEN -43.8 AND -43.1)
      AND ${padQd} NOT IN (SELECT ${padQd} FROM citadas)),
  reaproveitados AS (
    -- Todas as linhas de dois codigos que a origem repete, para que a
    -- desduplicacao tenha o que descartar.
    SELECT * FROM ${qd} WHERE ${padQd} IN (
      SELECT ${padQd} FROM ${qd} WHERE ${padQd} IS NOT NULL
      GROUP BY 1 HAVING count(*) > 1 ORDER BY 1 LIMIT 2)),
  sem_codigo AS (
    SELECT * FROM ${qd} WHERE column1 = 'NULL' ORDER BY column0 LIMIT 2),
  sem_endereco AS (
    SELECT * FROM ${qd} WHERE column4 = 'NULL'
      AND ${padQd} NOT IN (SELECT ${padQd} FROM citadas)
    ORDER BY column0 LIMIT 3)
  SELECT DISTINCT ON (column0) * FROM (
  SELECT * FROM citadas
  UNION ALL SELECT * FROM fora_do_rio
  UNION ALL SELECT * FROM sem_endereco
  UNION ALL SELECT * FROM sem_codigo
  UNION ALL SELECT * FROM reaproveitados) ORDER BY column0`);

await c.run(`CREATE TABLE amostra_ug AS
  SELECT * FROM ${ug} WHERE ${padUg} IN (SELECT ${padQd} FROM amostra_qd)
  UNION
  SELECT * FROM ${ug}
  WHERE TRY_CAST(LATITUDE AS DOUBLE) NOT BETWEEN -23.1 AND -22.7
     OR TRY_CAST(LONGITUDE AS DOUBLE) NOT BETWEEN -43.8 AND -43.1`);

// Uma unidade da amostra fica de fora do arquivo de localizacao, para que a
// checagem `unidade_sem_localizacao` tenha o que encontrar.
await c.run(`DELETE FROM amostra_ug WHERE ${padUg} = (SELECT min(cod) FROM ${codigos})`);

const tmp = join(OUT, '_tmp.csv');
// Sem ORDER BY explicito o DuckDB nao garante a ordem das linhas, e a fixture
// mudaria de bytes a cada regeracao mesmo com o mesmo conteudo.
async function csv(table, file, header, ordem) {
  await c.run(
    `COPY (SELECT * FROM ${table} ORDER BY ${ordem}) TO '${tmp}' (FORMAT CSV, DELIMITER ';', HEADER ${header}, NULLSTR 'NULL')`,
  );
  const body = Buffer.concat([BOM, readFileSync(tmp)]);
  writeFileSync(join(OUT, file), file.endsWith('.gz') ? gzipSync(body) : body);
  rmSync(tmp);
}
await csv(
  'amostra_qa',
  '01_QueryA_InscricoesPorAno.csv.gz',
  true,
  'ano, prm_id, plm_id, ipl_id, opcao',
);
await csv(
  'amostra_qb',
  '02_QueryB_RespostasSocioEconomicas.csv.gz',
  true,
  'ano, prm_id, plm_id, ipl_id, ich_perg_id',
);
await csv('amostra_qc', '03_QueryC_PerguntasComDescricao.csv', true, 'ano, prm_id, ich_perg_id');
await csv('amostra_qd', '04_UnidadesEscolaresComEndereco.csv', false, 'column0');

await c.run(
  `COPY (SELECT * FROM amostra_ug ORDER BY DESIGNACAO, DENOMINACAO) TO '${join(OUT, 'oferecimentos/Unidades_Unificadas_com_Localizacao.xlsx')}' (FORMAT XLSX, SHEET 'Unidades_Unificadas', HEADER true)`,
);

await c.run(`COPY (SELECT objectid, cre, cod_territ, geom FROM st_read('${RAW}/microareas/Microareas_SME_revisao.shp') ORDER BY objectid LIMIT 8)
  TO '${join(OUT, 'microareas/Microareas_SME_revisao.shp')}' (FORMAT GDAL, DRIVER 'ESRI Shapefile', SRS 'EPSG:31983')`);

for (const t of ['amostra_qa', 'amostra_qb', 'amostra_qc', 'amostra_qd', 'amostra_ug']) {
  const r = await (await c.run(`SELECT count(*) n FROM ${t}`)).getRowObjectsJson();
  console.log(t.padEnd(12), r[0].n);
}
