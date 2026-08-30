import { z } from 'zod';

/**
 * Formato unico de erro da API.
 *
 * PRD 13.5 proibe expor stack trace; PRD 13.4 proibe PII em mensagens de erro.
 * O corpo carrega apenas codigo estavel, mensagem curta, o correlation ID
 * (PRD 16.1) e a lista de campos invalidos com o caminho, sem ecoar o valor
 * recebido do usuario.
 */
export const fieldIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    correlationId: z.string(),
    issues: z.array(fieldIssueSchema).optional(),
  }),
});

export type FieldIssue = z.infer<typeof fieldIssueSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
