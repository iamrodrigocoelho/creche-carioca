import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadConfig, type PipelineConfig } from './config';
import { openConnection, queryValue, sqlLiteral, toCount } from './duckdb';
import { fingerprint, importVersionFor, type ImportManifest } from './provenance';
import { SOURCE_FILES } from './sources';
import {
  CURATED_TABLES,
  createCuratedTables,
  createStagingViews,
  curatedFileName,
} from './staging';
import {
  assertPublishable,
  assertUnitsReconcile,
  EXPECTED_ROWS,
  runQualityChecks,
  validateKeys,
  type QualityReport,
} from './quality';

export const PIPELINE_VERSION = '1.0.0';

export interface IngestOptions {
  readonly config?: PipelineConfig;
  readonly importVersion?: string;
  readonly now?: Date;
  /**
   * Contagens exigidas antes de publicar. Os testes sobrescrevem para rodar
   * sobre fixtures pequenas; a producao usa as contagens publicadas pela origem.
   */
  readonly expectedRows?: Readonly<Record<string, number>>;
}

export interface IngestResult {
  readonly outputDir: string;
  readonly manifest: ImportManifest;
  readonly report: QualityReport;
}

/**
 * Falha cedo e com instrucao acionavel: os datasets nao sao versionados, entao a
 * ausencia deles e o caso comum em maquina nova, nao um bug.
 */
function assertSourcesPresent(rawDir: string): void {
  const missing = SOURCE_FILES.filter((source) => !existsSync(join(rawDir, source.path)));
  if (missing.length === 0) return;
  throw new Error(
    `Arquivos de origem ausentes em ${rawDir}:\n` +
      missing.map((source) => `  - ${source.path}`).join('\n') +
      '\nBaixe de https://github.com/CIT-SME-RJ/dadoscreche ou aponte DATA_RAW_DIR para as amostras.',
  );
}

export async function ingest(options: IngestOptions = {}): Promise<IngestResult> {
  const config = options.config ?? loadConfig();
  assertSourcesPresent(config.rawDir);

  const importVersion = options.importVersion ?? importVersionFor(options.now);
  const outputDir = join(config.curatedDir, importVersion);
  // PRD 10.3: nao substituir silenciosamente uma versao ja importada.
  if (existsSync(outputDir)) {
    throw new Error(
      `A versao de importacao ${importVersion} ja existe em ${outputDir}. ` +
        'Remova o diretorio ou use outra versao — o pipeline nao sobrescreve.',
    );
  }

  const connection = await openConnection();
  await createStagingViews(connection, config.rawDir);
  await createCuratedTables(connection);

  const expectedRows = options.expectedRows ?? EXPECTED_ROWS;
  const report = await runQualityChecks(connection, expectedRows);
  assertPublishable(report, expectedRows);
  await validateKeys(connection);
  await assertUnitsReconcile(connection);

  await mkdir(outputDir, { recursive: true });
  const tables: { name: string; rows: number; file: string }[] = [];
  for (const table of CURATED_TABLES) {
    const file = curatedFileName(table);
    await connection.run(
      `COPY ${table} TO ${sqlLiteral(join(outputDir, file))} (FORMAT PARQUET, COMPRESSION ZSTD)`,
    );
    tables.push({
      name: table,
      rows: toCount(await queryValue(connection, `SELECT count(*) FROM ${table}`)),
      file,
    });
  }

  const manifest: ImportManifest = {
    importVersion,
    importedAt: (options.now ?? new Date()).toISOString(),
    pipelineVersion: PIPELINE_VERSION,
    rawDir: config.rawDir,
    sources: await Promise.all(
      SOURCE_FILES.map((source) => fingerprint(join(config.rawDir, source.path))),
    ),
    tables,
  };

  await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    join(outputDir, 'relatorio-qualidade.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  connection.closeSync();
  return { outputDir, manifest, report };
}
