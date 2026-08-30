import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/**
 * Configuracao de caminhos do pipeline.
 *
 * Os datasets nao sao versionados (`.gitignore` cobre `data/raw/`), entao o
 * caminho e configuravel: quem nao tiver os arquivos aponta `DATA_RAW_DIR` para
 * as amostras sinteticas em vez de travar a execucao.
 */
export interface PipelineConfig {
  readonly rawDir: string;
  readonly curatedDir: string;
}

/** Sobe a partir de `from` ate achar a raiz do monorepo (marcada pelo workspace do pnpm). */
export function findRepoRoot(from: string = __dirname): string {
  let current = resolve(from);
  for (;;) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Raiz do monorepo nao encontrada a partir de ${from}`);
    }
    current = parent;
  }
}

function fromEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') return fallback;
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

export function loadConfig(root: string = findRepoRoot()): PipelineConfig {
  return {
    rawDir: fromEnv('DATA_RAW_DIR', join(root, 'data', 'raw')),
    curatedDir: fromEnv('DATA_CURATED_DIR', join(root, 'data', 'curated')),
  };
}
