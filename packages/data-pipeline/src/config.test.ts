import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { findRepoRoot, loadConfig } from './config';

const originais = { raw: process.env['DATA_RAW_DIR'], curated: process.env['DATA_CURATED_DIR'] };

afterEach(() => {
  for (const [chave, valor] of [
    ['DATA_RAW_DIR', originais.raw],
    ['DATA_CURATED_DIR', originais.curated],
  ] as const) {
    if (valor === undefined) delete process.env[chave];
    else process.env[chave] = valor;
  }
});

describe('findRepoRoot', () => {
  it('encontra a raiz do monorepo a partir do pacote', () => {
    expect(findRepoRoot()).toBe(resolve(__dirname, '..', '..', '..'));
  });

  it('falha com mensagem clara fora do monorepo', async () => {
    const solto = await mkdtemp(join(tmpdir(), 'match-solto-'));
    try {
      expect(() => findRepoRoot(solto)).toThrow(/Raiz do monorepo nao encontrada/);
    } finally {
      await rm(solto, { recursive: true, force: true });
    }
  });
});

describe('loadConfig', () => {
  it('usa data/raw e data/curated por padrao', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'match-raiz-'));
    try {
      await writeFile(join(raiz, 'pnpm-workspace.yaml'), 'packages: []\n');
      delete process.env['DATA_RAW_DIR'];
      delete process.env['DATA_CURATED_DIR'];
      expect(loadConfig(raiz)).toEqual({
        rawDir: join(raiz, 'data', 'raw'),
        curatedDir: join(raiz, 'data', 'curated'),
      });
    } finally {
      await rm(raiz, { recursive: true, force: true });
    }
  });

  it('permite apontar para outro diretorio, para rodar sem os datasets', () => {
    process.env['DATA_RAW_DIR'] = '/tmp/amostras';
    expect(loadConfig('/qualquer').rawDir).toBe('/tmp/amostras');
  });

  it('resolve caminho relativo contra o diretorio de trabalho', () => {
    process.env['DATA_RAW_DIR'] = 'amostras';
    expect(loadConfig('/qualquer').rawDir).toBe(resolve(process.cwd(), 'amostras'));
  });

  it('ignora variavel vazia e volta ao padrao', () => {
    process.env['DATA_RAW_DIR'] = '   ';
    expect(loadConfig('/raiz').rawDir).toBe(join('/raiz', 'data', 'raw'));
  });
});
