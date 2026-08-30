import { join } from 'node:path';

import type { DuckDBConnection } from '@duckdb/node-api';

import {
  readCsvGz,
  readShapefile,
  readXlsx,
  sqlCep,
  sqlNullify,
  sqlText,
  sqlUnitCode,
} from './sources';

/**
 * Views de staging e tabelas curadas.
 *
 * Nada aqui materializa as bases grandes em memoria: as views leem direto do
 * arquivo e o DuckDB faz streaming ate a escrita do Parquet (PRD 10.3).
 */
export async function createStagingViews(
  connection: DuckDBConnection,
  rawDir: string,
): Promise<void> {
  const path = (relative: string): string => join(rawDir, relative);

  await connection.run(`
    CREATE VIEW stg_inscricoes AS
    SELECT
      TRY_CAST(ano AS INTEGER)                       AS ano,
      TRY_CAST(prm_id AS INTEGER)                    AS prm_id,
      TRY_CAST(plm_id AS INTEGER)                    AS plm_id,
      TRY_CAST(ipl_id AS INTEGER)                    AS ipl_id,
      TRY_CAST(opcao AS INTEGER)                     AS opcao,
      ${sqlUnitCode('unidade')}                      AS unidade_codigo,
      ${sqlText('nome_unidade')}                     AS unidade_nome,
      ${sqlText('grupamento')}                       AS grupamento,
      ${sqlNullify('horario')}                       AS horario,
      TRY_CAST(data_criacao AS TIMESTAMP)            AS data_criacao,
      ${sqlNullify('aluno_anon')}                    AS aluno_anon,
      ${sqlNullify('sexo_crianca')}                  AS sexo_crianca,
      ${sqlNullify('nascimento_aluno_anomes')}       AS nascimento_anomes,
      ${sqlNullify('responsavel_anon')}              AS responsavel_anon,
      ${sqlCep('CEP')}                               AS cep,
      ${sqlText('bairro')}                           AS bairro,
      ${sqlNullify('situacao')}                      AS situacao
    FROM ${readCsvGz(path('01_QueryA_InscricoesPorAno.csv.gz'), true)}
  `);

  await connection.run(`
    CREATE VIEW stg_respostas AS
    SELECT
      TRY_CAST(ano AS INTEGER)          AS ano,
      TRY_CAST(prm_id AS INTEGER)       AS prm_id,
      TRY_CAST(plm_id AS INTEGER)       AS plm_id,
      TRY_CAST(ipl_id AS INTEGER)       AS ipl_id,
      TRY_CAST(ich_perg_id AS INTEGER)  AS ich_perg_id,
      ${sqlText('pergunta_texto')}      AS pergunta_texto,
      TRY_CAST(pergunta_ordem AS INTEGER) AS pergunta_ordem,
      ${sqlNullify('resposta')}         AS resposta,
      ${sqlNullify('confirmado')}       AS confirmado
    FROM ${readCsvGz(path('02_QueryB_RespostasSocioEconomicas.csv.gz'), true)}
  `);

  await connection.run(`
    CREATE VIEW stg_perguntas AS
    SELECT
      TRY_CAST(ano AS INTEGER)                     AS ano,
      TRY_CAST(prm_id AS INTEGER)                  AS prm_id,
      TRY_CAST(ich_perg_id AS INTEGER)             AS ich_perg_id,
      TRY_CAST(perg_id AS INTEGER)                 AS perg_id,
      ${sqlText('pergunta_texto')}                 AS pergunta_texto,
      TRY_CAST("perg_ordemVisualizacao" AS INTEGER) AS ordem,
      TRY_CAST(perg_pontuacao AS INTEGER)          AS pontuacao,
      ${sqlNullify('perg_criterio')}               AS criterio_desempate
    FROM ${readCsvGz(path('03_QueryC_PerguntasComDescricao.csv'), true)}
  `);

  // PRD 10.4: o arquivo nao tem cabecalho. Ler com header=true descartaria a
  // primeira unidade silenciosamente, entao as colunas vem posicionais.
  await connection.run(`
    CREATE VIEW stg_unidades_endereco AS
    SELECT
      TRY_CAST(column0 AS INTEGER)  AS seq_interno,
      ${sqlUnitCode('column1')}     AS unidade_codigo,
      ${sqlText('column2')}         AS nome,
      ${sqlNullify('column3')}      AS tipo_codigo,
      ${sqlText('column4')}         AS logradouro,
      ${sqlNullify('column5')}      AS numero,
      ${sqlText('column6')}         AS complemento,
      ${sqlText('column7')}         AS bairro,
      ${sqlCep('column8')}          AS cep
    FROM ${readCsvGz(path('04_UnidadesEscolaresComEndereco.csv'), false)}
  `);

  await connection.run(`
    CREATE VIEW stg_unidades_local AS
    SELECT
      ${sqlUnitCode('DESIGNACAO')}          AS unidade_codigo,
      TRY_CAST(CRE AS INTEGER)              AS cre,
      ${sqlNullify('"microárea"')}          AS microarea,
      ${sqlText('DENOMINACAO')}             AS nome,
      ${sqlText('RUA')}                     AS endereco,
      ${sqlText('BAIRRO')}                  AS bairro,
      TRY_CAST(LATITUDE AS DOUBLE)          AS latitude,
      TRY_CAST(LONGITUDE AS DOUBLE)         AS longitude,
      ${sqlText('Tipo')}                    AS tipo
    FROM ${readXlsx(path(join('oferecimentos', 'Unidades_Unificadas_com_Localizacao.xlsx')), 'Unidades_Unificadas')}
  `);

  // O shapefile vem em SIRGAS 2000 / UTM 23S; reprojetado para WGS84 para ficar
  // no mesmo referencial das coordenadas das unidades.
  await connection.run(`
    CREATE VIEW stg_microareas AS
    SELECT
      TRY_CAST(objectid AS INTEGER) AS objectid,
      TRY_CAST(cre AS INTEGER)      AS cre,
      ${sqlNullify('cod_territ')}   AS microarea,
      ST_AsText(ST_Transform(geom, 'EPSG:31983', 'EPSG:4326', always_xy := true)) AS geometria_wkt
    FROM ${readShapefile(path(join('microareas', 'Microareas_SME_revisao.shp')))}
  `);
}

/**
 * Tabelas curadas.
 *
 * `cur_unidades` e a junção que fecha a lacuna geografica: a Query D tem o
 * endereco completo das 2.188 unidades mas nenhuma coordenada, e o
 * `Unidades_Unificadas` tem coordenada, CRE e microarea. A Query D e o lado
 * esquerdo porque cobre 872/872 dos codigos vistos nas inscricoes.
 */
export async function createCuratedTables(connection: DuckDBConnection): Promise<void> {
  // O `esc_codigo` NAO e unico na Query D: 78 codigos aparecem em mais de uma
  // linha. Sao dois fenomenos distintos — a mesma unidade grafada de dois jeitos
  // (uma linha com endereco, outra sem) e, entre as parceiras, codigos
  // reaproveitados por instituicoes diferentes ao longo dos anos. Publicar sem
  // resolver isso faria a juncao com as inscricoes multiplicar linhas em
  // silencio, entao a escolha e deterministica: vence a linha com endereco e,
  // no empate, o menor `seq_interno`. As descartadas viram achado no relatorio.
  // O criterio de desempate vive num lugar so: `cur_unidades` e
  // `cur_unidades_descartadas` sao os dois lados do mesmo ranqueamento, e
  // duplicar a janela abriria espaco para eles discordarem.
  await connection.run(`
    CREATE VIEW stg_unidades_ranqueadas AS
    SELECT *, row_number() OVER (
      PARTITION BY unidade_codigo
      ORDER BY (logradouro IS NULL), seq_interno
    ) AS posicao
    FROM stg_unidades_endereco
    WHERE unidade_codigo IS NOT NULL
  `);

  await connection.run(`
    CREATE TABLE cur_unidades AS
    SELECT
      e.unidade_codigo,
      coalesce(e.nome, l.nome)      AS nome,
      l.tipo,
      e.logradouro,
      e.numero,
      e.complemento,
      coalesce(e.bairro, l.bairro)  AS bairro,
      e.cep,
      l.cre,
      l.microarea,
      l.latitude,
      l.longitude,
      (l.latitude IS NOT NULL AND l.longitude IS NOT NULL) AS tem_coordenada,
      (e.logradouro IS NOT NULL)                           AS tem_endereco
    FROM stg_unidades_ranqueadas e
    LEFT JOIN stg_unidades_local l USING (unidade_codigo)
    WHERE e.posicao = 1
  `);

  // As linhas perdidas na desduplicacao, para o relatorio de qualidade.
  await connection.run(`
    CREATE TABLE cur_unidades_descartadas AS
    SELECT unidade_codigo, seq_interno, nome
    FROM stg_unidades_ranqueadas WHERE posicao > 1
  `);

  await connection.run('CREATE TABLE cur_inscricoes AS SELECT * FROM stg_inscricoes');
  await connection.run('CREATE TABLE cur_respostas AS SELECT * FROM stg_respostas');
  await connection.run('CREATE TABLE cur_catalogo_perguntas AS SELECT * FROM stg_perguntas');
  await connection.run('CREATE TABLE cur_microareas AS SELECT * FROM stg_microareas');
}

export const CURATED_TABLES = [
  'cur_unidades',
  'cur_inscricoes',
  'cur_respostas',
  'cur_catalogo_perguntas',
  'cur_microareas',
] as const;

export type CuratedTable = (typeof CURATED_TABLES)[number];

export function curatedFileName(table: CuratedTable): string {
  return `${table.replace(/^cur_/, '')}.parquet`;
}
