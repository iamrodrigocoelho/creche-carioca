import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { PipelineConfig } from './config';
import { normalizeUnitCode } from './normalize';
import { ingest, type IngestResult } from './pipeline';

const FIXTURES = join(__dirname, '..', 'test', 'fixtures');

/**
 * Contagens das fixtures. Sao propositalmente diferentes das contagens de
 * producao: o portao de publicacao precisa ser exercitado com valores reais do
 * conjunto sob teste, nao desligado.
 */
const EXPECTED_FIXTURE_ROWS = {
  stg_inscricoes: 171,
  stg_perguntas: 65,
  stg_unidades_endereco: 57,
} as const;

let curatedDir: string;
let result: IngestResult;

async function makeConfig(): Promise<PipelineConfig> {
  return { rawDir: FIXTURES, curatedDir: await mkdtemp(join(tmpdir(), 'match-curated-')) };
}

beforeAll(async () => {
  const config = await makeConfig();
  curatedDir = config.curatedDir;
  result = await ingest({
    config,
    importVersion: '2026-08-30T00-00-00-000Z',
    now: new Date('2026-08-30T00:00:00.000Z'),
    expectedRows: EXPECTED_FIXTURE_ROWS,
  });
});

afterAll(async () => {
  if (curatedDir !== undefined) await rm(curatedDir, { recursive: true, force: true });
});

describe('ingest', () => {
  it('publica um Parquet por tabela curada', () => {
    for (const table of result.manifest.tables) {
      expect(existsSync(join(result.outputDir, table.file))).toBe(true);
    }
    expect(result.manifest.tables.map((table) => table.name)).toEqual([
      'cur_unidades',
      'cur_inscricoes',
      'cur_respostas',
      'cur_catalogo_perguntas',
      'cur_microareas',
    ]);
  });

  it('le todos os formatos de origem: csv.gz, csv sem cabecalho, xlsx e shapefile', () => {
    const rows = Object.fromEntries(result.manifest.tables.map((t) => [t.name, t.rows]));
    expect(rows['cur_inscricoes']).toBe(171);
    expect(rows['cur_catalogo_perguntas']).toBe(65);
    // O shapefile so entra se a extensao spatial reprojetou a geometria.
    expect(rows['cur_microareas']).toBeGreaterThan(0);
  });

  it('registra origem, hash, data e versao de cada importacao', async () => {
    const manifest = JSON.parse(
      await readFile(join(result.outputDir, 'manifest.json'), 'utf8'),
    ) as typeof result.manifest;
    expect(manifest.importVersion).toBe('2026-08-30T00-00-00-000Z');
    expect(manifest.importedAt).toBe('2026-08-30T00:00:00.000Z');
    expect(manifest.sources).toHaveLength(6);
    for (const source of manifest.sources) {
      expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(source.bytes).toBeGreaterThan(0);
    }
  });

  it('nao sobrescreve silenciosamente uma versao ja importada', async () => {
    await expect(
      ingest({
        config: { rawDir: FIXTURES, curatedDir },
        importVersion: '2026-08-30T00-00-00-000Z',
        expectedRows: EXPECTED_FIXTURE_ROWS,
      }),
    ).rejects.toThrow(/ja existe/);
  });

  it('falha com instrucao acionavel quando faltam arquivos de origem', async () => {
    const vazio = await mkdtemp(join(tmpdir(), 'match-vazio-'));
    try {
      await expect(
        ingest({ config: { rawDir: vazio, curatedDir }, importVersion: 'qualquer' }),
      ).rejects.toThrow(/Arquivos de origem ausentes/);
    } finally {
      await rm(vazio, { recursive: true, force: true });
    }
  });

  it('bloqueia a publicacao quando a contagem da origem diverge', async () => {
    await expect(
      ingest({
        config: { rawDir: FIXTURES, curatedDir },
        importVersion: 'contagem-errada',
        expectedRows: { stg_inscricoes: 999_999 },
      }),
    ).rejects.toThrow(/Validacao de contagem falhou/);
    expect(existsSync(join(curatedDir, 'contagem-errada'))).toBe(false);
  });
});

describe('normalizacao aplicada na ingestao', () => {
  it('preserva zeros a esquerda em codigos e CEPs', async () => {
    const { openConnection, queryRows } = await import('./duckdb');
    const connection = await openConnection();
    try {
      const rows = await queryRows(
        connection,
        `SELECT unidade_codigo, cep FROM read_parquet('${join(result.outputDir, 'unidades.parquet')}')
         WHERE unidade_codigo LIKE '0%' AND cep IS NOT NULL LIMIT 5`,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(String(row['unidade_codigo'])).toMatch(/^0/);
        expect(String(row['cep'])).toHaveLength(8);
      }
    } finally {
      connection.closeSync();
    }
  });

  it('nao perde a primeira unidade do arquivo sem cabecalho', async () => {
    // PRD 10.4: ler o arquivo com header=true consumiria a primeira unidade como
    // se fosse cabecalho. O teste ancora na primeira linha real da fixture, e nao
    // num codigo fixo, para continuar valendo se a amostra for regerada.
    const bruto = await readFile(join(FIXTURES, '04_UnidadesEscolaresComEndereco.csv'), 'utf8');
    const primeiraLinha = bruto.replace(/^\uFEFF/, '').split(/\r?\n/)[0] ?? '';
    const primeiroCodigo = normalizeUnitCode(primeiraLinha.split(';')[1]);
    expect(primeiroCodigo).not.toBeNull();

    const { openConnection, queryValue, toCount } = await import('./duckdb');
    const connection = await openConnection();
    try {
      const encontrada = toCount(
        await queryValue(
          connection,
          `SELECT count(*) FROM read_parquet('${join(result.outputDir, 'unidades.parquet')}')
           WHERE unidade_codigo = '${primeiroCodigo}'`,
        ),
      );
      expect(encontrada).toBe(1);
    } finally {
      connection.closeSync();
    }
  });
});
