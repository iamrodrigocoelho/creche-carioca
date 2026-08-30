import { normalizeCep } from '@match/domain';
import { z } from 'zod';

/**
 * Contratos dos pontos de referencia (RF-02, PRD 8.2).
 *
 * Os pontos servem apenas a recomendacao de unidades e nunca alteram a
 * pontuacao oficial — invariante que o servico tambem repete, porque e a razao
 * de a familia poder informa-los sem receio.
 */

export const ANCHOR_KINDS = ['RESIDENCIA', 'TRABALHO', 'REDE_APOIO', 'OUTRO'] as const;
export const GEOCODING_STATUSES = ['PENDENTE', 'RESOLVIDO', 'FALHOU'] as const;

/** Posicao 1 e a residencia; 2 e 3 sao os pontos opcionais de PRD 8.2. */
export const MIN_ANCHOR_POSITION = 1;
export const MAX_ANCHOR_POSITION = 3;
export const RESIDENCE_POSITION = 1;

export const anchorKindSchema = z.enum(ANCHOR_KINDS, {
  error: 'Selecione o tipo do ponto de referência.',
});

export const geocodingStatusSchema = z.enum(GEOCODING_STATUSES);

/**
 * Aceita o que a familia digita e guarda oito digitos.
 *
 * `transform` roda antes das checagens seguintes, entao `20931-004` e `20931004`
 * chegam iguais ao servico e a comparacao de duplicidade nao depende da forma.
 */
export const cepSchema = z
  .string({ error: 'Informe o CEP.' })
  .trim()
  .min(1, 'Informe o CEP.')
  .max(20, 'CEP inválido.')
  .transform((value, ctx) => {
    const normalized = normalizeCep(value);
    if (normalized === null) {
      ctx.addIssue({ code: 'custom', message: 'Informe um CEP com 8 dígitos.' });
      return z.NEVER;
    }
    return normalized;
  });

export const anchorPositionSchema = z
  .number({ error: 'Posição inválida.' })
  .int('Posição inválida.')
  .min(MIN_ANCHOR_POSITION, 'Posição inválida.')
  .max(MAX_ANCHOR_POSITION, 'São no máximo três pontos de referência.');

/**
 * Rotulo livre da familia. Limitado em tamanho e sem caracteres de marcacao:
 * PRD 13.5 pede validacao no limite, e este campo e reexibido na interface.
 */
export const anchorLabelSchema = z
  .string()
  .trim()
  .max(60, 'Use no máximo 60 caracteres no rótulo.')
  .regex(/^[^<>]*$/, 'O rótulo não pode conter os caracteres < ou >.');

export const createLocationAnchorSchema = z
  .object({
    cep: cepSchema,
    kind: anchorKindSchema,
    label: anchorLabelSchema.optional(),
    /** Omitida, a API usa a primeira posicao livre. */
    position: anchorPositionSchema.optional(),
  })
  .refine((value) => value.position !== RESIDENCE_POSITION || value.kind === 'RESIDENCIA', {
    path: ['kind'],
    message: 'O primeiro ponto de referência é o CEP de residência.',
  });

export const locationAnchorSchema = z.object({
  id: z.uuid(),
  position: anchorPositionSchema,
  kind: anchorKindSchema,
  cep: z.string().regex(/^\d{8}$/),
  label: z.string().nullable(),
  status: geocodingStatusSchema,
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  /**
   * Raio de incerteza em quilometros. A geocodificacao e simulada e resolve no
   * nivel do setor do CEP, entao a interface precisa poder dizer isso (PRD 8.5).
   */
  precisionKm: z.number().nullable(),
  /** Sustenta a escolha por bairro quando `status` e `FALHOU` (PRD 8.2). */
  neighborhood: z.string().nullable(),
  /**
   * Posicao do ponto anterior com o mesmo CEP. PRD 8.2 manda **sinalizar**
   * duplicidade, nao recusar: repetir um CEP e uma escolha legitima da familia.
   */
  duplicateOfPosition: z.number().int().nullable(),
  lastValidatedAt: z.iso.datetime().nullable(),
});

export const locationAnchorListSchema = z.object({
  applicationId: z.uuid(),
  anchors: z.array(locationAnchorSchema),
  /** `false` enquanto faltar a residencia; a interface usa para liberar o avanco. */
  hasResidence: z.boolean(),
});

/** Bairros conhecidos, para o fallback textual quando o CEP nao resolve. */
export const neighborhoodListSchema = z.object({
  neighborhoods: z.array(z.string()),
});

export type AnchorKind = (typeof ANCHOR_KINDS)[number];
export type GeocodingStatus = (typeof GEOCODING_STATUSES)[number];
export type CreateLocationAnchorInput = z.input<typeof createLocationAnchorSchema>;
export type CreateLocationAnchorParsed = z.output<typeof createLocationAnchorSchema>;
export type LocationAnchorResponse = z.infer<typeof locationAnchorSchema>;
export type LocationAnchorListResponse = z.infer<typeof locationAnchorListSchema>;
export type NeighborhoodListResponse = z.infer<typeof neighborhoodListSchema>;
