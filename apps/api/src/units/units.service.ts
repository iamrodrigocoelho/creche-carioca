import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  isFarFromAllAnchors,
  recommendUnits,
  type RecommendableUnit,
  type RecommendationAnchor,
  type RecommendedUnit,
} from '@match/domain';
import type {
  PreferenceListResponse,
  PutPreferencesInput,
  RecommendationListResponse,
  RecommendationQuery,
  UnitCard,
} from '@match/schemas';

import { resolveAgeGroup } from '@match/domain';

import { currentCorrelationId } from '../common/logging/correlation';
import { ANONYMOUS_ACTOR } from '../common/write-context';
import { AuditService } from '../database/audit.service';
import { PrismaService } from '../database/prisma.service';
import { RuleVersionService } from '../database/rule-version.service';

/**
 * Recomendacao de unidades e preferencias (RF-05, RF-06).
 *
 * A ordenacao e a explicacao vem do dominio; aqui se monta a consulta e se
 * traduz o resultado. Duas escolhas merecem nota:
 *
 * - Os filtros (bairro, CRE, tipo, busca) reduzem o conjunto porque sao decisao
 *   explicita da familia. A **proximidade nunca reduz** — ela so ordena, como
 *   PRD 8.5 exige ao proibir que a recomendacao territorial impeca a escolha
 *   livre de outra unidade valida.
 * - Grupamentos e turnos vem do historico de 2021 a 2025. Nao ha oferta
 *   declarada para 2026 nos datasets, e apresentar historico como oferta seria
 *   exatamente o que PRD 1.2 proibe.
 */

const HISTORICAL_NOTICE =
  'Grupamentos, turnos e demanda vêm das inscrições de 2021 a 2025. Não são a oferta de 2026, que ainda não foi publicada.';

@Injectable()
export class UnitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: RuleVersionService,
  ) {}

  async recommend(query: RecommendationQuery): Promise<RecommendationListResponse> {
    const application = await this.requireApplication(query.applicationId);
    const anchors = await this.anchorsFor(query.applicationId);

    const where = {
      ...(query.neighborhood
        ? { neighborhood: { equals: query.neighborhood, mode: 'insensitive' as const } }
        : {}),
      ...(query.cre !== undefined ? { cre: query.cre } : {}),
      ...(query.type ? { type: { equals: query.type, mode: 'insensitive' as const } } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };

    const rows = await this.prisma.client.unit.findMany({ where });
    const ranked = recommendUnits({
      units: rows.map(toRecommendable),
      anchors,
      ...(application.ageGroupCode ? { ageGroupCode: application.ageGroupCode } : {}),
      ...(application.shift ? { shift: application.shift } : {}),
    });

    return {
      units: ranked.slice(0, query.limit).map(toCard),
      total: ranked.length,
      hasAnchors: anchors.length > 0,
      historicalNotice: HISTORICAL_NOTICE,
    };
  }

  async listPreferences(applicationId: string): Promise<PreferenceListResponse> {
    await this.requireApplication(applicationId);
    return this.buildPreferenceList(applicationId);
  }

  /**
   * Substitui a lista inteira (PRD 8.6: "registrar a ordem exata submetida").
   *
   * Apagar e reinserir numa transacao e mais simples e mais fiel que reconciliar
   * posicao a posicao: a ordem enviada e o dado, e reconciliar abriria espaco
   * para estados intermediarios que violam a unicidade de posicao.
   */
  async replacePreferences(
    applicationId: string,
    input: PutPreferencesInput,
  ): Promise<PreferenceListResponse> {
    await this.requireApplication(applicationId);

    const codes = input.preferences.map((item) => item.unitCode);
    const units = await this.prisma.client.unit.findMany({
      where: { code: { in: codes } },
      select: { id: true, code: true },
    });
    const byCode = new Map(units.map((unit) => [unit.code, unit.id]));

    const missing = codes.filter((code) => !byCode.has(code));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'UNKNOWN_UNIT',
        message: 'Uma das unidades escolhidas não existe.',
      });
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.preference.deleteMany({ where: { applicationId } });
      await tx.preference.createMany({
        data: input.preferences.map((item, index) => ({
          applicationId,
          unitId: byCode.get(item.unitCode) as string,
          position: index + 1,
          ageGroupCode: item.ageGroupCode,
          shift: item.shift,
        })),
      });

      await this.audit.record(
        {
          correlationId: currentCorrelationId(),
          ...ANONYMOUS_ACTOR,
          action: 'PREFERENCES_REPLACE',
          entity: 'Preference',
          entityId: applicationId,
          metadata: { applicationId, unidades: codes, ordem: codes.length },
        },
        tx,
      );
    });

    return this.buildPreferenceList(applicationId);
  }

  private async buildPreferenceList(applicationId: string): Promise<PreferenceListResponse> {
    const anchors = await this.anchorsFor(applicationId);
    const rows = await this.prisma.client.preference.findMany({
      where: { applicationId },
      orderBy: { position: 'asc' },
      include: { unit: true },
    });

    return {
      applicationId,
      preferences: rows.map((row) => {
        const [ranked] = recommendUnits({ units: [toRecommendable(row.unit)], anchors });
        return {
          position: row.position,
          unit: {
            id: row.unit.id,
            code: row.unit.code,
            name: row.unit.name,
            type: row.unit.type,
            neighborhood: row.unit.neighborhood,
            demandLevel: row.unit.demandLevel,
          },
          ageGroupCode:
            row.ageGroupCode as PreferenceListResponse['preferences'][number]['ageGroupCode'],
          shift: row.shift as PreferenceListResponse['preferences'][number]['shift'],
          distances: [...(ranked?.distances ?? [])],
          isFar: ranked !== undefined && isFarFromAllAnchors(ranked),
        };
      }),
    };
  }

  /** Só pontos geocodificados entram: sem coordenada não há distância a estimar. */
  private async anchorsFor(applicationId: string): Promise<RecommendationAnchor[]> {
    const rows = await this.prisma.client.locationAnchor.findMany({
      where: { applicationId, status: 'RESOLVIDO' },
      orderBy: { position: 'asc' },
    });

    return rows.flatMap((row) =>
      row.latitude === null || row.longitude === null
        ? []
        : [
            {
              position: row.position,
              kind: row.kind,
              latitude: row.latitude,
              longitude: row.longitude,
              precisionKm: row.precisionKm,
              neighborhood: row.neighborhood,
            },
          ],
    );
  }

  /**
   * Carrega a inscricao e resolve o grupamento pela regra versionada.
   *
   * O grupamento nao e persistido (ADR-0012): e recalculado na leitura, aqui
   * como em qualquer outro lugar.
   */
  private async requireApplication(
    applicationId: string,
  ): Promise<{ ageGroupCode: string | null; shift: string | null }> {
    const application = await this.prisma.client.application.findUnique({
      where: { id: applicationId },
      include: { child: true, process: { select: { code: true } } },
    });
    if (!application) {
      throw new NotFoundException({
        code: 'APPLICATION_NOT_FOUND',
        message: 'Inscrição não encontrada.',
      });
    }

    const policy = await this.rules.findAgeGroupPolicy(application.process.code);
    const resolution = policy
      ? resolveAgeGroup({
          birthYear: application.child.birthYear,
          birthMonth: application.child.birthMonth,
          policy,
          ...(application.referenceDateOverride
            ? { referenceDate: application.referenceDateOverride }
            : {}),
        })
      : null;

    return {
      ageGroupCode: resolution?.band?.code ?? null,
      shift: SHIFT_LABELS[application.desiredShift] ?? null,
    };
  }
}

/** Turno do domínio para o rótulo usado nas bases históricas. */
const SHIFT_LABELS: Readonly<Record<string, string>> = {
  INTEGRAL: 'Integral',
  PARCIAL: 'Parcial',
};

function toRecommendable(row: {
  id: string;
  code: string;
  name: string;
  type: string | null;
  neighborhood: string | null;
  cre: number | null;
  latitude: number | null;
  longitude: number | null;
  historicalAgeGroups: string[];
  historicalShifts: string[];
  historicalApplications: number;
  demandLevel: string;
}): RecommendableUnit {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    neighborhood: row.neighborhood,
    cre: row.cre,
    latitude: row.latitude,
    longitude: row.longitude,
    historicalAgeGroups: row.historicalAgeGroups,
    historicalShifts: row.historicalShifts,
    historicalApplications: row.historicalApplications,
    demandLevel: row.demandLevel as RecommendableUnit['demandLevel'],
  };
}

function toCard(recommended: RecommendedUnit): UnitCard {
  return {
    id: recommended.unit.id,
    code: recommended.unit.code,
    name: recommended.unit.name,
    type: recommended.unit.type,
    neighborhood: recommended.unit.neighborhood,
    cre: recommended.unit.cre,
    historicalAgeGroups: [...recommended.unit.historicalAgeGroups],
    historicalShifts: [...recommended.unit.historicalShifts],
    demandLevel: recommended.unit.demandLevel,
    historicalApplications: recommended.unit.historicalApplications,
    distances: [...recommended.distances],
    nearestKm: recommended.nearestKm,
    reasons: [...recommended.reasons],
    isFar: isFarFromAllAnchors(recommended),
  };
}
