import { AGE_GROUP_CODES } from '@match/domain';
import type { AgeGroupPolicy } from '@match/domain';
import { z } from 'zod';

/**
 * Validação do conteúdo de `RuleVersion.payload` (PRD 8.7, 11).
 *
 * O payload é gravado como JSON no PostgreSQL, então o banco não garante sua
 * forma. Este schema é a fronteira: nenhuma regra chega ao motor de decisão sem
 * ter sido validada aqui. Uma regra malformada precisa falhar de modo explícito,
 * e nunca ser silenciosamente ignorada — PRD 8.7 exige que a pontuação seja
 * reconstruível a partir da versão registrada.
 */

export const ageGroupBandSchema = z
  .object({
    code: z.enum(AGE_GROUP_CODES),
    label: z.string().min(1),
    minAgeMonths: z.number().int().min(0),
    maxAgeMonths: z.number().int().min(0),
  })
  .refine((band) => band.minAgeMonths <= band.maxAgeMonths, {
    message: 'A idade mínima da faixa não pode ser maior que a máxima.',
  });

export const ageGroupPolicyPayloadSchema = z.object({
  bands: z.array(ageGroupBandSchema).min(1, 'A política precisa de ao menos uma faixa.'),
});

export type AgeGroupPolicyPayload = z.infer<typeof ageGroupPolicyPayloadSchema>;

/**
 * Reconstrói a política de domínio a partir da linha de `RuleVersion`.
 *
 * Os metadados de versionamento (id, versão, status, processo, data de corte)
 * vêm das colunas — não do JSON — para que o banco continue sendo a autoridade
 * sobre qual regra estava vigente.
 */
export function toAgeGroupPolicy(input: {
  readonly id: string;
  readonly version: number;
  readonly status: 'DEMONSTRACAO' | 'OFICIAL';
  readonly processCode: string;
  readonly referenceDate: string;
  readonly source: string;
  readonly payload: unknown;
}): AgeGroupPolicy {
  const payload = ageGroupPolicyPayloadSchema.parse(input.payload);

  return {
    id: input.id,
    version: input.version,
    status: input.status,
    processId: input.processCode,
    referenceDate: input.referenceDate,
    source: input.source,
    bands: payload.bands,
  };
}
