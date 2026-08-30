import 'reflect-metadata';

import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { DomainError } from '@match/domain';
import { createApplicationSchema } from '@match/schemas';
import { describe, expect, it } from 'vitest';

import { loadEnv } from './config/env';
import { normalizeException } from './filters/all-exceptions.filter';
import { IdempotencyStore } from './idempotency/idempotency.store';
import { buildLogRecord, JsonLogger } from './logging/json-logger';
import { normalizeCorrelationId } from './logging/correlation';
import { REDACTED, isSensitiveKey, redact } from './logging/redact';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';

/**
 * Configuracao minima para a API subir. `CONTACT_FINGERPRINT_KEY` entrou na
 * Fase 5 e nao tem padrao de proposito (ADR-0027): uma chave embutida no codigo
 * seria publica, e um indice cego com chave publica nao esconde nada.
 */
const MINIMAL_ENV = {
  DATABASE_URL: 'postgresql://u@localhost:5432/db',
  CONTACT_FINGERPRINT_KEY: 'chave-de-teste-com-tamanho-suficiente-0123',
};

describe('loadEnv', () => {
  it('aplica os padroes de desenvolvimento', () => {
    const env = loadEnv({ ...MINIMAL_ENV });

    expect(env.API_PORT).toBe(3333);
    expect(env.API_CORS_ORIGINS).toEqual(['http://localhost:3000']);
  });

  it('divide a allowlist de CORS por virgula', () => {
    const env = loadEnv({
      ...MINIMAL_ENV,
      API_CORS_ORIGINS: 'http://a.example, https://b.example',
    });

    expect(env.API_CORS_ORIGINS).toEqual(['http://a.example', 'https://b.example']);
  });

  it('exige a chave do indice cego de contatos (ADR-0027)', () => {
    const { CONTACT_FINGERPRINT_KEY: _omitida, ...semChave } = MINIMAL_ENV;
    expect(() => loadEnv(semChave)).toThrowError(/CONTACT_FINGERPRINT_KEY/);
  });

  it('rejeita curinga em CORS (PRD 13.5)', () => {
    expect(() => loadEnv({ ...MINIMAL_ENV, API_CORS_ORIGINS: '*' })).toThrowError(
      /Configuracao invalida/,
    );
  });

  it('rejeita porta fora do intervalo valido', () => {
    expect(() => loadEnv({ ...MINIMAL_ENV, API_PORT: '70000' })).toThrowError(
      /Configuracao invalida/,
    );
  });

  // A partir da Fase 2 a API nao opera sem banco: melhor falhar na inicializacao
  // do que subir e quebrar na primeira escrita.
  it('exige DATABASE_URL', () => {
    expect(() => loadEnv({})).toThrowError(/DATABASE_URL/);
  });

  it('rejeita DATABASE_URL que nao seja PostgreSQL', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://u@localhost:3306/db' })).toThrowError(
      /PostgreSQL/,
    );
  });
});

describe('redact (PRD 13.4 / 16.1)', () => {
  it('mascara campos sensiveis em qualquer profundidade', () => {
    const result = redact({
      safe: 'ok',
      phone: '+5521999999999',
      nested: { cep: '20000-000', deeper: { token: 'abc' } },
      list: [{ email: 'a@b.c' }],
    }) as Record<string, any>;

    expect(result.safe).toBe('ok');
    expect(result.phone).toBe(REDACTED);
    expect(result.nested.cep).toBe(REDACTED);
    expect(result.nested.deeper.token).toBe(REDACTED);
    expect(result.list[0].email).toBe(REDACTED);
  });

  it('ignora diferenca de caixa no nome do campo', () => {
    expect(isSensitiveKey('PhoneNumber')).toBe(true);
    expect(isSensitiveKey('unitName')).toBe(false);
  });

  it('descarta chaves de prototype pollution (PRD 13.5)', () => {
    const result = redact(JSON.parse('{"__proto__":{"polluted":true},"ok":1}')) as Record<
      string,
      unknown
    >;

    expect(result).not.toHaveProperty('__proto__');
    expect(result.ok).toBe(1);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('interrompe a recursao em estruturas muito profundas', () => {
    let deep: unknown = 'fim';
    for (let i = 0; i < 12; i += 1) deep = { next: deep };

    expect(JSON.stringify(redact(deep))).toContain(REDACTED);
  });

  it('preserva valores primitivos', () => {
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
  });
});

describe('JsonLogger (PRD 16.1)', () => {
  it('emite JSON com timestamp UTC, nivel e correlation ID', () => {
    const lines: string[] = [];
    const logger = new JsonLogger('teste', 'debug', (line) => lines.push(line));

    logger.log('operacao', { unitId: 'u-1' });

    const record = JSON.parse(lines[0] as string);
    expect(record.level).toBe('info');
    expect(record.service).toBe('teste');
    expect(record.message).toBe('operacao');
    expect(record.timestamp).toMatch(/Z$/);
    expect(record.correlationId).toBeTruthy();
  });

  it('redige o contexto antes de serializar', () => {
    const lines: string[] = [];
    const logger = new JsonLogger('teste', 'debug', (line) => lines.push(line));

    logger.warn('contato', { phone: '+5521999999999' });

    expect(lines[0]).not.toContain('5521999999999');
    expect(lines[0]).toContain(REDACTED);
  });

  it('respeita o nivel minimo configurado', () => {
    const lines: string[] = [];
    const logger = new JsonLogger('teste', 'error', (line) => lines.push(line));

    logger.debug('ignorado');
    logger.log('ignorado');
    logger.error('registrado');

    expect(lines).toHaveLength(1);
  });

  it('omite o contexto quando nao informado', () => {
    const record = buildLogRecord('info', 'msg', 'svc', '2026-08-30T00:00:00.000Z');

    expect(record).not.toHaveProperty('context');
  });
});

describe('normalizeCorrelationId', () => {
  it('preserva um identificador de formato seguro', () => {
    expect(normalizeCorrelationId('abc-12345678')).toBe('abc-12345678');
  });

  it.each(['curto', 'com espaco e injecao\n', '<script>', 42, undefined])(
    'gera um novo identificador para %s',
    (candidate) => {
      const generated = normalizeCorrelationId(candidate);

      expect(generated).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});

describe('ZodValidationPipe (PRD 13.5)', () => {
  const pipe = new ZodValidationPipe(createApplicationSchema);

  it('retorna o valor tipado quando valido', () => {
    const parsed = pipe.transform({
      processId: 'DEMO-2026',
      child: { birthYear: 2024, birthMonth: 3 },
      desiredShift: 'INTEGRAL',
    });

    expect(parsed.processId).toBe('DEMO-2026');
  });

  it('lanca BadRequest com caminho do campo e sem o valor recebido', () => {
    try {
      pipe.transform({ processId: 'DEMO-2026', child: { birthYear: 2024, birthMonth: 77 } });
      expect.unreachable('deveria ter lancado');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const payload = (error as BadRequestException).getResponse() as Record<string, any>;
      expect(payload.code).toBe('VALIDATION_FAILED');
      expect(payload.issues.map((issue: any) => issue.path)).toContain('child.birthMonth');
      expect(JSON.stringify(payload)).not.toContain('77');
    }
  });
});

describe('normalizeException', () => {
  it('mapeia erro de dominio para 400', () => {
    const normalized = normalizeException(new DomainError('INVALID_BIRTH_MONTH', 'mes invalido'));

    expect(normalized.status).toBe(HttpStatus.BAD_REQUEST);
    expect(normalized.code).toBe('INVALID_BIRTH_MONTH');
  });

  it('mapeia politica invalida para 422', () => {
    expect(normalizeException(new DomainError('INVALID_POLICY', 'x')).status).toBe(
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  });

  it('preserva codigo e issues de HttpException estruturada', () => {
    const normalized = normalizeException(
      new BadRequestException({ code: 'X', message: 'msg', issues: [{ path: 'a', message: 'b' }] }),
    );

    expect(normalized).toMatchObject({ status: 400, code: 'X', message: 'msg' });
    expect(normalized.issues).toHaveLength(1);
  });

  it('trata HttpException com corpo textual', () => {
    const normalized = normalizeException(new HttpException('texto', HttpStatus.FORBIDDEN));

    expect(normalized).toMatchObject({ status: 403, code: 'HTTP_403', message: 'texto' });
  });

  it('converte erro desconhecido em 500 generico, sem vazar detalhe', () => {
    const normalized = normalizeException(new Error('SELECT * FROM segredo'));

    expect(normalized.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(normalized.code).toBe('INTERNAL_ERROR');
    expect(normalized.message).not.toContain('segredo');
  });
});

describe('IdempotencyStore (PRD 12.4)', () => {
  it('devolve o valor guardado para a mesma chave e escopo', () => {
    const store = new IdempotencyStore();
    store.set('POST /x', 'chave-com-8', { id: 1 });

    expect(store.get('POST /x', 'chave-com-8')).toEqual({ id: 1 });
  });

  it('isola escopos diferentes', () => {
    const store = new IdempotencyStore();
    store.set('POST /x', 'chave-com-8', { id: 1 });

    expect(store.get('POST /y', 'chave-com-8')).toBeUndefined();
  });

  it('expira a entrada apos o TTL', () => {
    let now = 0;
    const store = new IdempotencyStore(1000, () => now);
    store.set('POST /x', 'chave-com-8', { id: 1 });

    now = 1001;
    expect(store.get('POST /x', 'chave-com-8')).toBeUndefined();
    expect(store.size).toBe(0);
  });

  it.each(['curta', 'a'.repeat(129), 'com espaco aqui', '../../etc'])(
    'rejeita a chave %s',
    (key) => {
      expect(() => IdempotencyStore.assertValidKey(key)).toThrowError(BadRequestException);
    },
  );

  it('aceita chave opaca de formato seguro', () => {
    expect(() => IdempotencyStore.assertValidKey('chave-valida-123')).not.toThrow();
  });
});
