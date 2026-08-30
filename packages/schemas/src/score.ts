import { CONFIRMATION_POLICIES } from '@match/matching-engine';
import { z } from 'zod';

/**
 * Contratos da pontuacao (RF-07, PRD 8.7).
 *
 * A explicacao e sempre estruturada: codigos estaveis e numeros, nunca texto
 * pronto. PRD 8.7 permite que um LLM reescreva a explicacao em linguagem
 * simples, mas proibe que ele altere os numeros — separar as duas coisas no
 * contrato e o que torna essa fronteira verificavel.
 */

export const confirmationPolicySchema = z.enum(CONFIRMATION_POLICIES);

export const scoreLineOutcomeSchema = z.enum([
  'PONTUOU',
  'RESPOSTA_NEGATIVA',
  'NAO_RESPONDIDA',
  'AGUARDA_CONFIRMACAO',
  'CRITERIO_DE_DESEMPATE',
]);

export const scoreLineSchema = z.object({
  code: z.number().int(),
  text: z.string(),
  order: z.number().int(),
  /** Peso do criterio na regua vigente. */
  weight: z.number().int(),
  /** Pontos efetivamente somados. */
  awarded: z.number().int(),
  answer: z.boolean().nullable(),
  confirmed: z.boolean(),
  outcome: scoreLineOutcomeSchema,
});

export const tiebreakLineSchema = z.object({
  code: z.number().int(),
  text: z.string(),
  order: z.number().int(),
  applies: z.boolean(),
});

export const scoreRuleRefSchema = z.object({
  processCode: z.string(),
  version: z.number().int(),
  /** `DEMONSTRACAO` enquanto a regra de 2026 nao for publicada (B-07). */
  status: z.enum(['DEMONSTRACAO', 'OFICIAL']),
  /** Ano de onde a regua foi derivada. Exibir junto do total (PRD 1.2). */
  sourceYear: z.number().int(),
  confirmationPolicy: confirmationPolicySchema,
});

export const scoreResultSchema = z.object({
  id: z.uuid(),
  applicationId: z.uuid(),
  total: z.number().int(),
  maxTotal: z.number().int(),
  lines: z.array(scoreLineSchema),
  tiebreaks: z.array(tiebreakLineSchema),
  rule: scoreRuleRefSchema,
  computedAt: z.iso.datetime(),
});

/** Catalogo vigente, para a familia responder (PRD 8.7). */
export const criterionSchema = z.object({
  code: z.number().int(),
  text: z.string(),
  order: z.number().int(),
  points: z.number().int(),
  isTiebreak: z.boolean(),
  /** Resposta ja registrada, quando houver. */
  answer: z.boolean().nullable(),
  confirmed: z.boolean(),
});

export const criterionListSchema = z.object({
  applicationId: z.uuid(),
  criteria: z.array(criterionSchema),
  rule: scoreRuleRefSchema,
  /** `false` enquanto algum criterio pontuavel seguir sem resposta. */
  isComplete: z.boolean(),
});

export const criterionAnswerInputSchema = z.object({
  code: z.number().int().min(1, 'Critério inválido.'),
  answer: z.boolean({ error: 'Responda sim ou não.' }),
});

export const putCriterionResponsesSchema = z.object({
  responses: z
    .array(criterionAnswerInputSchema)
    .min(1, 'Responda ao menos um critério.')
    .max(50, 'Respostas demais.')
    .refine((items) => new Set(items.map((item) => item.code)).size === items.length, {
      message: 'O mesmo critério não pode ser respondido duas vezes.',
    }),
});

export const scoreHistorySchema = z.object({
  applicationId: z.uuid(),
  /** Do mais recente para o mais antigo. Nenhum resultado e sobrescrito. */
  results: z.array(scoreResultSchema),
});

export type ConfirmationPolicy = z.infer<typeof confirmationPolicySchema>;
export type ScoreLineResponse = z.infer<typeof scoreLineSchema>;
export type ScoreResultResponse = z.infer<typeof scoreResultSchema>;
export type CriterionResponseItem = z.infer<typeof criterionSchema>;
export type CriterionListResponse = z.infer<typeof criterionListSchema>;
export type PutCriterionResponsesInput = z.infer<typeof putCriterionResponsesSchema>;
export type ScoreHistoryResponse = z.infer<typeof scoreHistorySchema>;
