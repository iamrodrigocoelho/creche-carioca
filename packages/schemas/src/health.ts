import { z } from 'zod';

/** PRD 16.4: `/health/live` prova que o processo esta vivo. */
export const livenessSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number(),
});

/**
 * PRD 16.4: `/health/ready` verifica dependencias criticas. Dependencias opcionais
 * simuladas nao podem indisponibilizar a aplicacao, entao aparecem como `skipped`.
 */
export const readinessSchema = z.object({
  status: z.enum(['ready', 'not_ready']),
  checks: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['up', 'down', 'skipped']),
      critical: z.boolean(),
      detail: z.string().optional(),
    }),
  ),
});

export type Liveness = z.infer<typeof livenessSchema>;
export type Readiness = z.infer<typeof readinessSchema>;
