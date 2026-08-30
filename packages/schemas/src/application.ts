import { AGE_GROUP_CODES, SHIFTS } from '@match/domain';
import type { AgeGroupResolution } from '@match/domain';
import { z } from 'zod';

/**
 * Contratos da inscricao (RF-01). Fonte unica de validacao: a API valida no limite
 * (PRD 13.5) e a web reaproveita o mesmo schema, evitando divergencia de regra.
 *
 * A fatia da Fase 1 cobre apenas crianca, processo, turno e grupamento calculado.
 * Ancoras de CEP (RF-02), contatos (RF-03/04) e preferencias (RF-06) entram nas
 * fases seguintes, conforme IMPLEMENTATION_PLAN.md.
 */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const sexSchema = z.enum(['FEMININO', 'MASCULINO', 'NAO_INFORMADO']);
/**
 * As mensagens sao escritas em linguagem simples e orientadas a acao (PRD 17),
 * porque sao exibidas diretamente a familia no resumo de erros do formulario.
 */
export const shiftSchema = z.enum(SHIFTS, { error: 'Selecione o turno desejado.' });
export const ageGroupCodeSchema = z.enum(AGE_GROUP_CODES);

export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_PATTERN, 'Informe a data no formato AAAA-MM-DD.');

/** Identificador de processo seletivo. Curto e sem caractere livre, para evitar injecao em filtros. */
export const processIdSchema = z
  .string()
  .trim()
  .min(1, 'Informe o processo seletivo.')
  .max(32, 'Processo seletivo invalido.')
  .regex(/^[A-Za-z0-9-]+$/, 'Processo seletivo invalido.');

export const childInputSchema = z.object({
  birthYear: z
    .number({ error: 'Selecione o ano de nascimento da criança.' })
    .int('O ano de nascimento deve ser um número inteiro.')
    .min(1900, 'Selecione um ano de nascimento válido.')
    .max(2100, 'Selecione um ano de nascimento válido.'),
  birthMonth: z
    .number({ error: 'Selecione o mês de nascimento da criança.' })
    .int('O mês de nascimento deve ser um número inteiro.')
    .min(1, 'O mês deve estar entre 1 e 12.')
    .max(12, 'O mês deve estar entre 1 e 12.'),
  sex: sexSchema.optional(),
});

export const createApplicationSchema = z.object({
  processId: processIdSchema,
  child: childInputSchema,
  desiredShift: shiftSchema,
  /** Sobrescreve a data de corte da regra. PRD 8.1 exige recalculo ao altera-la. */
  referenceDate: isoDateSchema.optional(),
});

export const updateApplicationSchema = z
  .object({
    child: childInputSchema.partial().optional(),
    desiredShift: shiftSchema.optional(),
    referenceDate: isoDateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  });

export const explanationStepSchema = z.object({
  code: z.string(),
  values: z.record(z.string(), z.union([z.string(), z.number()])),
  summary: z.string(),
});

export const ageGroupResultSchema = z.object({
  outcome: z.enum(['MATCHED', 'BELOW_MINIMUM_AGE', 'ABOVE_MAXIMUM_AGE']),
  code: ageGroupCodeSchema.nullable(),
  label: z.string().nullable(),
  ageInMonths: z.number().int(),
  referenceDate: isoDateSchema,
  policy: z.object({
    id: z.string(),
    version: z.number().int(),
    /** `DEMONSTRACAO` deve ser exibido na interface; PRD 1.2 proibe passar dado sintetico por oficial. */
    status: z.enum(['DEMONSTRACAO', 'OFICIAL']),
    processId: z.string(),
  }),
  explanation: z.array(explanationStepSchema),
});

export const applicationSchema = z.object({
  /** UUID v4: referencia publica nao sequencial (PRD 13.5). */
  id: z.uuid(),
  /** Identificador anonimo da crianca (PRD 8.1). Nenhum dado nominal e coletado. */
  anonymousChildId: z.uuid(),
  status: z.enum(['RASCUNHO']),
  processId: processIdSchema,
  child: childInputSchema,
  desiredShift: shiftSchema,
  ageGroup: ageGroupResultSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Sex = z.infer<typeof sexSchema>;
export type ChildInput = z.infer<typeof childInputSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type AgeGroupResult = z.infer<typeof ageGroupResultSchema>;
export type ApplicationResponse = z.infer<typeof applicationSchema>;

/**
 * Converte a resolucao do dominio no contrato publicado.
 *
 * Vive aqui, e nao na API, porque o build estatico resolve o grupamento no
 * proprio navegador e precisa produzir exatamente a mesma resposta (ADR-0027).
 */
export function toAgeGroupResult(resolution: AgeGroupResolution): AgeGroupResult {
  return {
    outcome: resolution.outcome,
    code: resolution.band?.code ?? null,
    label: resolution.band?.label ?? null,
    ageInMonths: resolution.ageInMonths,
    referenceDate: resolution.referenceDate,
    policy: resolution.policy,
    explanation: resolution.explanation.map((step) => ({
      code: step.code,
      values: step.values,
      summary: step.summary,
    })),
  };
}
