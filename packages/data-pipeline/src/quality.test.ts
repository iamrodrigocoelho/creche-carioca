import { join } from 'node:path';

import type { DuckDBConnection } from '@duckdb/node-api';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openConnection } from './duckdb';
import { normalizeCep, normalizeText, normalizeUnitCode, nullify } from './normalize';
import {
  assertUnitsReconcile,
  runQualityChecks,
  validateKeys,
  type QualityReport,
} from './quality';
import { sqlCep, sqlNullify, sqlText, sqlUnitCode } from './sources';
import { createCuratedTables, createStagingViews } from './staging';

const FIXTURES = join(__dirname, '..', 'test', 'fixtures');

let connection: DuckDBConnection;
let report: QualityReport;

beforeAll(async () => {
  connection = await openConnection();
  await createStagingViews(connection, FIXTURES);
  await createCuratedTables(connection);
  report = await runQualityChecks(connection, {});
});

afterAll(() => {
  connection?.closeSync();
});

describe('relatorio de qualidade', () => {
  /**
   * Teste de nao-regressao: as fixtures foram construidas para conter cada uma
   * das inconsistencias de PRD 10.4, entao qualquer contagem que va a zero
   * significa que a checagem parou de enxergar o problema.
   */
  it('encontra todas as inconsistencias conhecidas nas fixtures', () => {
    const contagens = Object.fromEntries(report.findings.map((f) => [f.id, f.count]));
    expect(contagens).toEqual({
      opcao_acima_de_cinco: 11,
      unidade_sem_localizacao: 1,
      coordenada_fora_do_rio: 1,
      unidade_sem_endereco: 6,
      inscricao_sem_cep: 4,
      situacao_sem_acentuacao: 1,
      pontuacao_varia_por_ano: 11,
      unidade_sem_codigo: 2,
      codigo_de_unidade_reaproveitado: 2,
      sem_timestamp_de_status: 1,
    });
  });

  it('registra a situacao exatamente como a origem grava, sem cedilha e sem til', () => {
    const achado = report.findings.find((f) => f.id === 'situacao_sem_acentuacao');
    expect(achado?.sample).toContain('Cancelado na confirmacao');
  });

  it('produz amostras deterministicas e limitadas', () => {
    for (const achado of report.findings) {
      expect(achado.sample.length).toBeLessThanOrEqual(10);
      expect([...achado.sample]).toEqual([...achado.sample].sort());
    }
  });

  it('aprova as chaves das tabelas curadas', async () => {
    await expect(validateKeys(connection)).resolves.toBeUndefined();
  });

  it('reconcilia todas as linhas do catalogo de unidades', async () => {
    // A soma exata vem do proprio conjunto; o que importa e que nada some
    // entre a origem e as tabelas curadas.
    await expect(assertUnitsReconcile(connection)).resolves.toBeUndefined();
  });

  it('detecta perda silenciosa de unidades', async () => {
    await connection.run('CREATE TABLE _guardado AS SELECT * FROM cur_unidades');
    await connection.run(
      'DELETE FROM cur_unidades WHERE rowid IN (SELECT rowid FROM cur_unidades LIMIT 1)',
    );
    try {
      await expect(assertUnitsReconcile(connection)).rejects.toThrow(
        /Reconciliacao de unidades falhou/,
      );
    } finally {
      await connection.run('DROP TABLE cur_unidades');
      await connection.run('ALTER TABLE _guardado RENAME TO cur_unidades');
    }
  });

  it('bloqueia a publicacao quando uma chave duplica', async () => {
    await connection.run('CREATE TABLE _backup AS SELECT * FROM cur_unidades');
    await connection.run('INSERT INTO cur_unidades SELECT * FROM cur_unidades LIMIT 1');
    try {
      await expect(validateKeys(connection)).rejects.toThrow(/Chave duplicada/);
    } finally {
      await connection.run('DROP TABLE cur_unidades');
      await connection.run('ALTER TABLE _backup RENAME TO cur_unidades');
    }
  });
});

describe('paridade entre as normalizacoes em SQL e em TypeScript', () => {
  /**
   * As regras existem duas vezes — em SQL, para rodar dentro do DuckDB sem
   * trazer as linhas para o Node, e em TypeScript, para serem testadas e
   * reutilizadas. Divergir seria um bug silencioso, entao a paridade e testada.
   */
  const entradas = ['1004', '01004', '101601', '0101601', 'NULL', '', '  ', 'AB1', '12345678'];

  it('normalizeUnitCode', async () => {
    const esperado = entradas.map((e) => normalizeUnitCode(e));
    const obtido = await avaliar(sqlUnitCode('valor'), entradas);
    expect(obtido).toEqual(esperado);
  });

  it('nullify e normalizeText', async () => {
    const textos = ['  CAJU ', 'NULL', 'SAO   CRISTOVAO', ''];
    expect(await avaliar(sqlNullify('valor'), textos)).toEqual(textos.map((t) => nullify(t)));
    expect(await avaliar(sqlText('valor'), textos)).toEqual(textos.map((t) => normalizeText(t)));
  });

  it('normalizeCep', async () => {
    const ceps = ['20931004', '20931-004', '1234', 'NULL', '209310041'];
    expect(await avaliar(sqlCep('valor'), ceps)).toEqual(ceps.map((c) => normalizeCep(c)));
  });

  async function avaliar(expressao: string, valores: string[]): Promise<(string | null)[]> {
    const lista = valores.map((valor) => `('${valor.replace(/'/g, "''")}')`).join(', ');
    await connection.run(
      `CREATE OR REPLACE TEMP TABLE _entrada AS SELECT * FROM (VALUES ${lista}) AS t(valor)`,
    );
    const resultado = await connection.run(`SELECT ${expressao} AS saida FROM _entrada`);
    const linhas = (await resultado.getRowObjectsJson()) as { saida: string | null }[];
    return linhas.map((linha) => linha.saida ?? null);
  }
});
