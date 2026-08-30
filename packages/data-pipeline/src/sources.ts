import { join } from 'node:path';

import { sqlLiteral } from './duckdb';
import { PARTNER_CODE_WIDTH, PUBLIC_CODE_WIDTH } from './normalize';

/**
 * Expressao SQL espelhando `normalizeUnitCode`. Mantida ao lado da versao em
 * TypeScript de proposito: um teste roda as duas sobre as mesmas entradas para
 * garantir que nao divirjam.
 */
export function sqlUnitCode(expr: string): string {
  return (
    `CASE WHEN regexp_full_match(trim(${expr}), '\\d+') ` +
    `THEN CASE WHEN length(trim(${expr})) <= ${PARTNER_CODE_WIDTH} ` +
    `THEN lpad(trim(${expr}), ${PARTNER_CODE_WIDTH}, '0') ` +
    `WHEN length(trim(${expr})) <= ${PUBLIC_CODE_WIDTH} ` +
    `THEN lpad(trim(${expr}), ${PUBLIC_CODE_WIDTH}, '0') END END`
  );
}

/** Expressao SQL espelhando `nullify`. */
export function sqlNullify(expr: string): string {
  return `nullif(nullif(trim(${expr}), ''), 'NULL')`;
}

/** Expressao SQL espelhando `normalizeText`. */
export function sqlText(expr: string): string {
  return `regexp_replace(${sqlNullify(expr)}, '\\s+', ' ', 'g')`;
}

/** Expressao SQL espelhando `normalizeCep`. */
export function sqlCep(expr: string): string {
  const digits = `regexp_replace(${sqlNullify(expr)}, '\\D', '', 'g')`;
  return `CASE WHEN length(${digits}) BETWEEN 1 AND 8 THEN lpad(${digits}, 8, '0') END`;
}

export interface SourceFile {
  /** Nome logico, usado no manifesto e no relatorio. */
  readonly id: string;
  /** Caminho relativo a `rawDir`. */
  readonly path: string;
  /** `false` para insumos de fases futuras, que sao apenas registrados. */
  readonly ingested: boolean;
  readonly description: string;
}

export const SOURCE_FILES: readonly SourceFile[] = [
  {
    id: 'query_a_inscricoes',
    path: '01_QueryA_InscricoesPorAno.csv.gz',
    ingested: true,
    description: 'Uma linha por opcao de creche escolhida (837.179 linhas).',
  },
  {
    id: 'query_b_respostas',
    path: '02_QueryB_RespostasSocioEconomicas.csv.gz',
    ingested: true,
    description: 'Uma linha por pergunta respondida (4.357.119 linhas).',
  },
  {
    id: 'query_c_perguntas',
    path: '03_QueryC_PerguntasComDescricao.csv',
    ingested: true,
    description: 'Catalogo de perguntas com a pontuacao por processo.',
  },
  {
    id: 'query_d_unidades',
    path: '04_UnidadesEscolaresComEndereco.csv',
    ingested: true,
    description: 'Enderecos de 2.188 unidades. Arquivo SEM linha de cabecalho.',
  },
  {
    id: 'unidades_localizacao',
    path: join('oferecimentos', 'Unidades_Unificadas_com_Localizacao.xlsx'),
    ingested: true,
    description: 'Unica fonte de latitude, longitude, CRE e microarea das unidades.',
  },
  {
    id: 'microareas',
    path: join('microareas', 'Microareas_SME_revisao.shp'),
    ingested: true,
    description: 'Poligonos das microareas SME/IPP em EPSG:31983.',
  },
];

/** Leitura crua: tudo como texto, para nao perder zeros a esquerda (PRD 10.3). */
export function readCsvGz(path: string, header: boolean): string {
  return `read_csv(${sqlLiteral(path)}, delim=';', header=${header}, all_varchar=true)`;
}

export function readXlsx(path: string, sheet: string): string {
  return `read_xlsx(${sqlLiteral(path)}, sheet=${sqlLiteral(sheet)}, all_varchar=true)`;
}

export function readShapefile(path: string): string {
  return `st_read(${sqlLiteral(path)})`;
}
