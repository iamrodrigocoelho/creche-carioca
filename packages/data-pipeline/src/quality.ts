import type { DuckDBConnection } from '@duckdb/node-api';

import { queryRows, queryValue, toCount } from './duckdb';
import { RIO_BOUNDS } from './normalize';

export type Severity = 'info' | 'aviso' | 'erro';

export interface QualityFinding {
  readonly id: string;
  readonly severity: Severity;
  /** Secao do PRD que motiva a checagem. */
  readonly reference: string;
  readonly summary: string;
  readonly count: number;
  /** Amostra determinística (ordenada) das ocorrencias, para inspecao manual. */
  readonly sample: readonly string[];
}

export interface QualityReport {
  readonly findings: readonly QualityFinding[];
  readonly rowCounts: Readonly<Record<string, number>>;
}

/**
 * Contagens publicadas no dicionario de dados da origem.
 *
 * Conferidas sobre o staging, nao sobre as tabelas curadas: `cur_unidades`
 * desduplica codigos reaproveitados e por isso tem menos linhas que o arquivo.
 * Divergir daqui significa que o arquivo de origem mudou.
 */
export const EXPECTED_ROWS: Readonly<Record<string, number>> = {
  stg_inscricoes: 837_179,
  stg_respostas: 4_357_119,
  stg_perguntas: 65,
  stg_unidades_endereco: 2_188,
};

/** Chaves que precisam ser unicas para que as juncoes a jusante nao multipliquem linhas. */
export const UNIQUE_KEYS: Readonly<Record<string, readonly string[]>> = {
  cur_unidades: ['unidade_codigo'],
  cur_inscricoes: ['prm_id', 'plm_id', 'ipl_id', 'opcao'],
  cur_catalogo_perguntas: ['prm_id', 'ich_perg_id'],
};

interface CheckSpec {
  readonly id: string;
  readonly severity: Severity;
  readonly reference: string;
  readonly summary: string;
  /** Deve projetar uma unica coluna textual `amostra`. */
  readonly sql: string;
}

/**
 * Cada checagem materializa as ocorrencias; a contagem sai do proprio conjunto
 * para que numero e amostra nunca discordem.
 */
const CHECKS: readonly CheckSpec[] = [
  {
    id: 'opcao_acima_de_cinco',
    severity: 'aviso',
    reference: 'PRD 10.4',
    summary: 'Inscricoes com numero de opcao maior que cinco.',
    sql: `SELECT DISTINCT concat_ws('/', ano, prm_id, plm_id, ipl_id, opcao) AS amostra
          FROM cur_inscricoes WHERE opcao > 5`,
  },
  {
    id: 'unidade_sem_localizacao',
    severity: 'aviso',
    reference: 'PRD 11 (Unit)',
    summary: 'Unidades citadas em inscricoes sem latitude/longitude conhecida.',
    sql: `SELECT DISTINCT i.unidade_codigo AS amostra
          FROM cur_inscricoes i
          JOIN cur_unidades u USING (unidade_codigo)
          WHERE NOT u.tem_coordenada`,
  },
  {
    id: 'coordenada_fora_do_rio',
    severity: 'erro',
    reference: 'PRD 10.3',
    summary: 'Unidades com coordenada fora da caixa delimitadora do municipio.',
    sql: `SELECT unidade_codigo AS amostra FROM cur_unidades
          WHERE tem_coordenada AND (
            latitude NOT BETWEEN ${RIO_BOUNDS.minLat} AND ${RIO_BOUNDS.maxLat}
            OR longitude NOT BETWEEN ${RIO_BOUNDS.minLon} AND ${RIO_BOUNDS.maxLon})`,
  },
  {
    id: 'unidade_sem_endereco',
    severity: 'info',
    reference: 'PRD 10.4',
    summary: 'Unidades do catalogo sem logradouro na origem (gravadas como NULL).',
    sql: `SELECT unidade_codigo AS amostra FROM cur_unidades WHERE NOT tem_endereco`,
  },
  {
    id: 'inscricao_sem_cep',
    severity: 'aviso',
    reference: 'PRD 10.3',
    summary: 'Inscricoes sem CEP do responsavel, que impedem ancorar a distancia.',
    sql: `SELECT DISTINCT concat_ws('/', prm_id, plm_id, ipl_id) AS amostra
          FROM cur_inscricoes WHERE cep IS NULL`,
  },
  {
    id: 'situacao_sem_acentuacao',
    severity: 'info',
    reference: 'PRD 10.4',
    summary: 'Valor gravado como "Cancelado na confirmacao", sem cedilha e sem til.',
    sql: `SELECT DISTINCT situacao AS amostra FROM cur_inscricoes
          WHERE situacao ILIKE 'Cancelado na confirm%'`,
  },
  {
    id: 'pontuacao_varia_por_ano',
    severity: 'aviso',
    reference: 'PRD 10.4',
    summary:
      'Perguntas cuja pontuacao muda entre processos: a regua nao e comparavel sem versionamento.',
    sql: `SELECT concat(perg_id, ': ', string_agg(DISTINCT lpad(pontuacao::VARCHAR, 3, '0'), '/' ORDER BY lpad(pontuacao::VARCHAR, 3, '0'))) AS amostra
          FROM cur_catalogo_perguntas
          GROUP BY perg_id HAVING count(DISTINCT pontuacao) > 1`,
  },
  {
    id: 'unidade_sem_codigo',
    severity: 'aviso',
    reference: 'PRD 10.4',
    summary:
      'Unidades cujo esc_codigo vem como NULL na origem; ficam fora das tabelas curadas por nao terem chave.',
    sql: `SELECT nome AS amostra FROM stg_unidades_endereco WHERE unidade_codigo IS NULL`,
  },
  {
    id: 'codigo_de_unidade_reaproveitado',
    severity: 'aviso',
    reference: 'PRD 10.4',
    summary:
      'Codigos presentes em mais de uma linha do catalogo de unidades; a linha sem endereco foi descartada.',
    sql: `SELECT concat(unidade_codigo, ': ', nome) AS amostra FROM cur_unidades_descartadas`,
  },
  {
    id: 'sem_timestamp_de_status',
    severity: 'info',
    reference: 'PRD 10.4',
    summary:
      'A origem so traz data de criacao da inscricao; sem timestamp de transicao nao ha tempo real de convocacao.',
    sql: `SELECT 'data_criacao' AS amostra FROM cur_inscricoes LIMIT 1`,
  },
];

const SAMPLE_LIMIT = 10;

export async function runQualityChecks(
  connection: DuckDBConnection,
  expectedRows: Readonly<Record<string, number>> = EXPECTED_ROWS,
): Promise<QualityReport> {
  const findings: QualityFinding[] = [];
  for (const check of CHECKS) {
    await connection.run(`CREATE OR REPLACE TEMP VIEW _check AS ${check.sql}`);
    const count = toCount(await queryValue(connection, 'SELECT count(*) FROM _check'));
    const rows = await queryRows(
      connection,
      `SELECT amostra FROM _check ORDER BY amostra LIMIT ${SAMPLE_LIMIT}`,
    );
    findings.push({
      id: check.id,
      severity: check.severity,
      reference: check.reference,
      summary: check.summary,
      count,
      sample: rows.map((row) => String(row['amostra'])),
    });
  }
  return { findings, rowCounts: await countCuratedRows(connection, expectedRows) };
}

/**
 * Validacao de chaves antes da publicacao (PRD 10.3).
 *
 * Diferente das inconsistencias de conteudo, uma chave duplicada nao e um fato
 * sobre a origem que se possa apenas registrar: ela corromperia toda juncao
 * feita sobre o Parquet publicado. Por isso bloqueia.
 */
export async function validateKeys(connection: DuckDBConnection): Promise<void> {
  const problems: string[] = [];
  for (const [table, columns] of Object.entries(UNIQUE_KEYS)) {
    const key = columns.join(', ');
    const duplicates = toCount(
      await queryValue(
        connection,
        `SELECT count(*) FROM (SELECT ${key} FROM ${table} GROUP BY ${key} HAVING count(*) > 1)`,
      ),
    );
    if (duplicates > 0) {
      problems.push(`${table}: ${duplicates} valor(es) duplicado(s) em (${key})`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Chave duplicada impede a publicacao:\n  ${problems.join('\n  ')}`);
  }
}

/**
 * Reconciliacao do catalogo de unidades (PRD 10.3).
 *
 * Toda linha da origem tem de terminar em um destes tres lugares: publicada,
 * descartada por codigo repetido, ou sem codigo. Se a soma nao fecha, o
 * pipeline perdeu linhas em algum lugar — e perder em silencio e exatamente o
 * que o criterio de aceite proibe.
 */
export async function assertUnitsReconcile(connection: DuckDBConnection): Promise<void> {
  const [origem, publicadas, descartadas, semCodigo] = await Promise.all([
    queryValue(connection, 'SELECT count(*) FROM stg_unidades_endereco').then(toCount),
    queryValue(connection, 'SELECT count(*) FROM cur_unidades').then(toCount),
    queryValue(connection, 'SELECT count(*) FROM cur_unidades_descartadas').then(toCount),
    queryValue(
      connection,
      'SELECT count(*) FROM stg_unidades_endereco WHERE unidade_codigo IS NULL',
    ).then(toCount),
  ]);
  const soma = publicadas + descartadas + semCodigo;
  if (soma !== origem) {
    throw new Error(
      `Reconciliacao de unidades falhou: origem tem ${origem} linhas, ` +
        `mas publicadas (${publicadas}) + descartadas (${descartadas}) + sem codigo (${semCodigo}) = ${soma}.`,
    );
  }
}

async function countCuratedRows(
  connection: DuckDBConnection,
  expectedRows: Readonly<Record<string, number>>,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of Object.keys(expectedRows)) {
    counts[table] = toCount(await queryValue(connection, `SELECT count(*) FROM ${table}`));
  }
  return counts;
}

/**
 * Portao de publicacao (PRD 10.3): contagem e chaves sao conferidas antes de
 * escrever qualquer Parquet. Divergir da contagem publicada pela origem
 * significa que o arquivo mudou — publicar em cima seria silencioso demais.
 */
export function assertPublishable(
  report: QualityReport,
  expectedRows: Readonly<Record<string, number>> = EXPECTED_ROWS,
): void {
  const problems: string[] = [];
  for (const [table, expected] of Object.entries(expectedRows)) {
    const actual = report.rowCounts[table];
    if (actual !== expected) {
      problems.push(`${table}: esperadas ${expected} linhas, encontradas ${actual ?? 0}`);
    }
  }
  const errors = report.findings.filter(
    (finding) => finding.severity === 'erro' && finding.count > 0,
  );
  if (problems.length > 0) {
    throw new Error(
      `Validacao de contagem falhou antes da publicacao:\n  ${problems.join('\n  ')}`,
    );
  }
  if (errors.length > 0) {
    // Erros de conteudo nao bloqueiam: sao inconsistencias da origem, e o
    // relatorio existe justamente para registra-las. Bloquear aqui impediria
    // qualquer publicacao enquanto a origem nao fosse corrigida.
    for (const error of errors) {
      process.stderr.write(`[qualidade] ${error.id}: ${error.count} ocorrencia(s)\n`);
    }
  }
}
