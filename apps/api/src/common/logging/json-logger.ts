import { Injectable, type LoggerService } from '@nestjs/common';

import { currentCorrelationId } from './correlation';
import { redact } from './redact';

/**
 * Logger JSON estruturado (PRD 16.1): timestamp UTC, nivel, servico, operacao,
 * correlation ID e nenhum dado pessoal completo. Todo contexto passa por
 * `redact` antes de ser serializado.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface LogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly service: string;
  readonly message: string;
  readonly correlationId: string;
  readonly context?: unknown;
}

export function buildLogRecord(
  level: LogLevel,
  message: string,
  service: string,
  timestamp: string,
  context?: unknown,
): LogRecord {
  return {
    timestamp,
    level,
    service,
    message,
    correlationId: currentCorrelationId(),
    ...(context === undefined ? {} : { context: redact(context) }),
  };
}

@Injectable()
export class JsonLogger implements LoggerService {
  private readonly threshold: number;

  constructor(
    private readonly service = 'match-api',
    minLevel: LogLevel = 'info',
    private readonly sink: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  ) {
    this.threshold = LEVEL_ORDER[minLevel];
  }

  private write(level: LogLevel, message: unknown, context?: unknown): void {
    if (LEVEL_ORDER[level] < this.threshold) return;

    const record = buildLogRecord(
      level,
      typeof message === 'string' ? message : JSON.stringify(redact(message)),
      this.service,
      new Date().toISOString(),
      context,
    );

    this.sink(JSON.stringify(record));
  }

  log(message: unknown, context?: unknown): void {
    this.write('info', message, context);
  }

  error(message: unknown, context?: unknown): void {
    this.write('error', message, context);
  }

  warn(message: unknown, context?: unknown): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: unknown): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: unknown): void {
    this.write('debug', message, context);
  }
}
