import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';

/** Origem, hash, data e versao de cada importacao (PRD 10.3). */
export interface SourceFingerprint {
  readonly file: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ImportManifest {
  readonly importVersion: string;
  readonly importedAt: string;
  readonly pipelineVersion: string;
  readonly rawDir: string;
  readonly sources: readonly SourceFingerprint[];
  readonly tables: readonly {
    readonly name: string;
    readonly rows: number;
    readonly file: string;
  }[];
}

/** Hash em streaming: os arquivos maiores passam de 150 MB descompactados. */
export async function fingerprint(path: string): Promise<SourceFingerprint> {
  const hash = createHash('sha256');
  await new Promise<void>((resolveHash, rejectHash) => {
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', rejectHash)
      .on('end', () => resolveHash());
  });
  const { size } = await stat(path);
  return { file: basename(path), bytes: size, sha256: hash.digest('hex') };
}

/**
 * Versao de importacao derivada do relogio, em UTC e ordenavel lexicograficamente.
 * Vira nome de diretorio, entao nao pode conter `:`.
 */
export function importVersionFor(now: Date = new Date()): string {
  return now.toISOString().replace(/[:.]/g, '-').replace('Z', 'Z');
}
