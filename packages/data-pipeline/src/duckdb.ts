import { type DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

/**
 * `spatial` le o shapefile das microareas e reprojeta de EPSG:31983 para
 * EPSG:4326; `excel` le o `Unidades_Unificadas_com_Localizacao.xlsx`.
 */
const REQUIRED_EXTENSIONS = ['excel', 'spatial'] as const;

export async function openConnection(): Promise<DuckDBConnection> {
  // Base em memoria: o pipeline le do disco em streaming e escreve Parquet; nao
  // ha estado a persistir entre execucoes (PRD 10.3).
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  for (const extension of REQUIRED_EXTENSIONS) {
    await connection.run(`INSTALL ${extension}`);
    await connection.run(`LOAD ${extension}`);
  }
  return connection;
}

/** Escapa um literal de texto para interpolacao segura em SQL. */
export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export async function queryRows(
  connection: DuckDBConnection,
  sql: string,
): Promise<Record<string, unknown>[]> {
  const result = await connection.run(sql);
  return (await result.getRowObjectsJson()) as Record<string, unknown>[];
}

/** Le uma unica linha escalar; util para contagens e checagens. */
export async function queryValue<T = unknown>(
  connection: DuckDBConnection,
  sql: string,
): Promise<T | undefined> {
  const rows = await queryRows(connection, sql);
  const first = rows[0];
  if (first === undefined) return undefined;
  return Object.values(first)[0] as T;
}

/** DuckDB devolve contagens como string (BIGINT); converte sem perder o erro. */
export function toCount(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) throw new Error(`Contagem invalida: ${String(value)}`);
  return parsed;
}
