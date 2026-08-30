import { AGE_GROUP_CODES, DEMAND_LEVELS, SHIFTS } from '@match/domain';
import { z } from 'zod';

/**
 * Contratos da recomendacao de unidades e das preferencias (RF-05, RF-06).
 */

export const demandLevelSchema = z.enum(DEMAND_LEVELS);

/** Estimativa sempre rotulada como estimativa (PRD 8.5). */
export const distanceEstimateSchema = z.object({
  km: z.number(),
  method: z.literal('GEODESICA'),
  /** Incerteza herdada da geocodificacao. `null` quando desconhecida. */
  precisionKm: z.number().nullable(),
});

export const anchorDistanceSchema = z.object({
  anchorPosition: z.number().int(),
  anchorKind: z.enum(['RESIDENCIA', 'TRABALHO', 'REDE_APOIO', 'OUTRO']),
  distance: distanceEstimateSchema,
});

/** Motivo estruturado; a interface escolhe as palavras (PRD 8.5). */
export const recommendationReasonSchema = z.object({
  code: z.enum([
    'PROXIMA_DA_RESIDENCIA',
    'PROXIMA_DE_OUTRO_PONTO',
    'MESMO_BAIRRO',
    'ATENDE_O_GRUPAMENTO',
    'ATENDE_O_TURNO',
    'DEMANDA_HISTORICA',
    'SEM_LOCALIZACAO',
  ]),
  values: z.record(z.string(), z.union([z.string(), z.number()])),
});

/** Campos minimos do card de PRD 8.5. */
export const unitCardSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  type: z.string().nullable(),
  neighborhood: z.string().nullable(),
  cre: z.number().int().nullable(),
  /**
   * Grupamentos e turnos OBSERVADOS de 2021 a 2025, nao oferta declarada de
   * 2026. PRD 8.5 exige rotular dado historico como historico.
   */
  historicalAgeGroups: z.array(z.string()),
  historicalShifts: z.array(z.string()),
  demandLevel: demandLevelSchema,
  historicalApplications: z.number().int(),
  distances: z.array(anchorDistanceSchema),
  nearestKm: z.number().nullable(),
  reasons: z.array(recommendationReasonSchema),
  /** Alerta informativo de PRD 8.6: informa, nao bloqueia. */
  isFar: z.boolean(),
});

export const recommendationListSchema = z.object({
  units: z.array(unitCardSchema),
  total: z.number().int(),
  /** `false` quando a inscricao ainda nao tem ponto de referencia geocodificado. */
  hasAnchors: z.boolean(),
  /**
   * A oferta de 2026 nao existe nos datasets; tudo que se sabe e historico.
   * Texto fixo para a interface exibir sem inventar redacao propria.
   */
  historicalNotice: z.string(),
});

export const recommendationQuerySchema = z.object({
  applicationId: z.uuid(),
  neighborhood: z.string().trim().max(80).optional(),
  cre: z.coerce.number().int().min(1).max(11).optional(),
  type: z.string().trim().max(40).optional(),
  /** Busca textual por nome, para o caminho de PRD 8.2 quando o CEP nao resolve. */
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const preferenceItemSchema = z.object({
  unitCode: z.string().regex(/^\d{5}$|^\d{7}$/, 'Código de unidade inválido.'),
  ageGroupCode: z.enum(AGE_GROUP_CODES),
  shift: z.enum(SHIFTS),
});

/**
 * PRD 8.6: de uma a cinco unidades, na ordem exata submetida. A lista inteira e
 * enviada de uma vez porque a ordem e o dado — enviar item a item obrigaria a
 * inventar semantica de insercao no meio.
 */
export const putPreferencesSchema = z.object({
  preferences: z
    .array(preferenceItemSchema)
    .min(1, 'Escolha ao menos uma unidade.')
    .max(5, 'São no máximo cinco unidades.')
    .refine(
      (items) =>
        new Set(items.map((item) => `${item.unitCode}|${item.ageGroupCode}|${item.shift}`)).size ===
        items.length,
      { message: 'A mesma unidade não pode se repetir para o mesmo grupamento e turno.' },
    ),
});

export const preferenceSchema = z.object({
  position: z.number().int(),
  unit: unitCardSchema.pick({
    id: true,
    code: true,
    name: true,
    type: true,
    neighborhood: true,
    demandLevel: true,
  }),
  ageGroupCode: z.enum(AGE_GROUP_CODES),
  shift: z.enum(SHIFTS),
  distances: z.array(anchorDistanceSchema),
  /** Alerta informativo, nunca bloqueio (PRD 8.6). */
  isFar: z.boolean(),
});

export const preferenceListSchema = z.object({
  applicationId: z.uuid(),
  preferences: z.array(preferenceSchema),
});

export type DemandLevel = z.infer<typeof demandLevelSchema>;
export type UnitCard = z.infer<typeof unitCardSchema>;
export type RecommendationListResponse = z.infer<typeof recommendationListSchema>;
export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;
export type PreferenceItem = z.infer<typeof preferenceItemSchema>;
export type PutPreferencesInput = z.infer<typeof putPreferencesSchema>;
export type PreferenceResponse = z.infer<typeof preferenceSchema>;
export type PreferenceListResponse = z.infer<typeof preferenceListSchema>;
