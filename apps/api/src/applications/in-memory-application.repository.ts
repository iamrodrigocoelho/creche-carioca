import { Injectable } from '@nestjs/common';

import type { ApplicationRecord, ApplicationRepository } from './application.repository';

/**
 * Adapter em memoria da Fase 1 (ADR-0003).
 *
 * Nao persiste entre reinicios e nao e adequado a producao - a Fase 2 o substitui
 * por PostgreSQL/Prisma. Os registros sao congelados para evitar mutacao acidental
 * do estado compartilhado.
 */
@Injectable()
export class InMemoryApplicationRepository implements ApplicationRepository {
  private readonly records = new Map<string, ApplicationRecord>();

  async create(record: ApplicationRecord): Promise<ApplicationRecord> {
    const frozen = Object.freeze({ ...record });
    this.records.set(record.id, frozen);
    return frozen;
  }

  async findById(id: string): Promise<ApplicationRecord | null> {
    return this.records.get(id) ?? null;
  }

  async update(record: ApplicationRecord): Promise<ApplicationRecord> {
    const frozen = Object.freeze({ ...record });
    this.records.set(record.id, frozen);
    return frozen;
  }

  get size(): number {
    return this.records.size;
  }
}
