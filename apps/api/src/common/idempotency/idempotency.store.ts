import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * Idempotencia de escrita (PRD 12.4: "Todos os endpoints de escrita devem aceitar
 * ou gerar chave de idempotencia quando houver risco de repeticao").
 *
 * Implementacao em memoria, adequada a Fase 1. A partir da Fase 11 (BullMQ/Redis)
 * a mesma porta passa a ser atendida por um store distribuido - por isso o
 * consumidor depende apenas dos metodos publicos abaixo.
 */

export const IDEMPOTENCY_HEADER = 'idempotency-key';

/** Aceita apenas chaves opacas e curtas, evitando cabecalho arbitrario como chave de cache. */
const SAFE_KEY = /^[A-Za-z0-9_-]{8,128}$/;

const DEFAULT_TTL_MS = 15 * 60 * 1000;

interface Entry {
  readonly expiresAt: number;
  readonly value: unknown;
}

@Injectable()
export class IdempotencyStore {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  static assertValidKey(key: string): void {
    if (!SAFE_KEY.test(key)) {
      throw new BadRequestException({
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'A chave de idempotência deve ter de 8 a 128 caracteres alfanuméricos.',
      });
    }
  }

  private compose(scope: string, key: string): string {
    return `${scope}::${key}`;
  }

  get<T>(scope: string, key: string): T | undefined {
    const entry = this.entries.get(this.compose(scope, key));
    if (!entry) return undefined;

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(this.compose(scope, key));
      return undefined;
    }

    return entry.value as T;
  }

  set(scope: string, key: string, value: unknown): void {
    this.entries.set(this.compose(scope, key), {
      expiresAt: this.now() + this.ttlMs,
      value,
    });
  }

  get size(): number {
    return this.entries.size;
  }
}
