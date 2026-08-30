import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  MAX_ANCHOR_POSITION,
  RESIDENCE_POSITION,
  type CreateLocationAnchorParsed,
  type LocationAnchorListResponse,
  type LocationAnchorResponse,
} from '@match/schemas';

import { CLOCK, type Clock } from '../common/clock';
import { currentCorrelationId } from '../common/logging/correlation';
import { ANONYMOUS_ACTOR, type WriteContext } from '../common/write-context';
import { GEOCODING_PROVIDER, type GeocodingProvider } from '../geocoding/geocoding.provider';
import {
  LOCATION_ANCHOR_REPOSITORY,
  UnknownApplicationError,
  type LocationAnchorRecord,
  type LocationAnchorRepository,
} from './location-anchor.repository';

/**
 * Casos de uso dos pontos de referencia (RF-02, PRD 8.2).
 *
 * Invariante central: **os pontos nao alteram a pontuacao**. Nada aqui toca
 * regra, peso ou classificacao — eles existem so para a recomendacao da Fase 6.
 * E por isso que informar um segundo ou terceiro CEP nunca prejudica ninguem.
 *
 * A geocodificacao acontece na escrita, nao na leitura: assim o resultado fica
 * gravado com a data em que foi validado, e a lista nao depende do provider
 * estar disponivel.
 */
@Injectable()
export class LocationAnchorsService {
  constructor(
    @Inject(LOCATION_ANCHOR_REPOSITORY)
    private readonly repository: LocationAnchorRepository,
    @Inject(GEOCODING_PROVIDER)
    private readonly geocoding: GeocodingProvider,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async list(applicationId: string): Promise<LocationAnchorListResponse> {
    const records = await this.repository.listByApplication(applicationId);
    return this.toListResponse(applicationId, records);
  }

  /**
   * Grava um ponto na posicao pedida, ou na primeira livre.
   *
   * E upsert de proposito: corrigir o CEP de residencia e uma operacao comum, e
   * obrigar a familia a remover antes de reinformar seria hostil — ainda mais
   * porque remover a residencia e proibido.
   */
  async upsert(
    applicationId: string,
    input: CreateLocationAnchorParsed,
  ): Promise<LocationAnchorListResponse> {
    const existing = await this.repository.listByApplication(applicationId);
    const position = input.position ?? this.nextFreePosition(existing);

    if (position === RESIDENCE_POSITION && input.kind !== 'RESIDENCIA') {
      throw new BadRequestException({
        code: 'ANCHOR_POSITION_MISMATCH',
        message: 'O primeiro ponto de referência é o CEP de residência.',
      });
    }
    if (position !== RESIDENCE_POSITION && input.kind === 'RESIDENCIA') {
      throw new BadRequestException({
        code: 'ANCHOR_POSITION_MISMATCH',
        message: 'A residência é sempre o primeiro ponto de referência.',
      });
    }

    const geocoded = await this.geocoding.geocode(input.cep);

    try {
      await this.repository.upsert(
        applicationId,
        {
          position,
          kind: input.kind,
          cep: input.cep,
          ...(input.label ? { label: input.label } : {}),
          ...(geocoded.status === 'RESOLVIDO'
            ? {
                status: 'RESOLVIDO' as const,
                latitude: geocoded.latitude,
                longitude: geocoded.longitude,
                precisionKm: geocoded.precisionKm,
                ...(geocoded.neighborhood ? { neighborhood: geocoded.neighborhood } : {}),
              }
            : { status: 'FALHOU' as const }),
          lastValidatedAt: this.clock(),
        },
        this.writeContext(),
      );
    } catch (error) {
      if (error instanceof UnknownApplicationError) throw applicationNotFound();
      throw error;
    }

    return this.list(applicationId);
  }

  async remove(applicationId: string, position: number): Promise<LocationAnchorListResponse> {
    // PRD 8.2: o CEP de residencia e obrigatorio. Os dois opcionais podem sair.
    if (position === RESIDENCE_POSITION) {
      throw new BadRequestException({
        code: 'RESIDENCE_ANCHOR_REQUIRED',
        message: 'O CEP de residência é obrigatório e não pode ser removido.',
      });
    }

    const removed = await this.repository.remove(applicationId, position, this.writeContext());
    if (!removed) throw anchorNotFound();

    return this.list(applicationId);
  }

  listNeighborhoods(): readonly string[] {
    return this.geocoding.listNeighborhoods();
  }

  /**
   * PRD 8.2 manda **sinalizar** CEP duplicado, nao recusar: uma familia pode
   * legitimamente ter trabalho e residencia no mesmo CEP. A marca aponta para a
   * primeira ocorrencia, para a interface poder explicar qual repete qual.
   */
  private toListResponse(
    applicationId: string,
    records: readonly LocationAnchorRecord[],
  ): LocationAnchorListResponse {
    const firstByCep = new Map<string, number>();
    const anchors: LocationAnchorResponse[] = records.map((record) => {
      const firstPosition = firstByCep.get(record.cep);
      if (firstPosition === undefined) firstByCep.set(record.cep, record.position);

      return {
        ...record,
        duplicateOfPosition: firstPosition ?? null,
      };
    });

    return {
      applicationId,
      anchors,
      hasResidence: records.some((record) => record.position === RESIDENCE_POSITION),
    };
  }

  private nextFreePosition(existing: readonly LocationAnchorRecord[]): number {
    const taken = new Set(existing.map((record) => record.position));
    for (let position = RESIDENCE_POSITION; position <= MAX_ANCHOR_POSITION; position += 1) {
      if (!taken.has(position)) return position;
    }
    throw new BadRequestException({
      code: 'ANCHOR_LIMIT_REACHED',
      message: 'São no máximo três pontos de referência. Remova um antes de adicionar outro.',
    });
  }

  private writeContext(): WriteContext {
    return { correlationId: currentCorrelationId(), ...ANONYMOUS_ACTOR };
  }
}

function applicationNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'APPLICATION_NOT_FOUND',
    message: 'Inscrição não encontrada.',
  });
}

function anchorNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'ANCHOR_NOT_FOUND',
    message: 'Ponto de referência não encontrado.',
  });
}
