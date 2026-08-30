import { z } from 'zod';

/**
 * Configuracao validada na inicializacao.
 *
 * PRD 13.4: segredos apenas em variaveis protegidas, nunca no repositorio.
 * PRD 13.5: CORS por allowlist explicita, limite de payload e rate limiting.
 * A aplicacao deve falhar rapido se a configuracao minima estiver ausente.
 */

/**
 * Lista separada por virgula. O `default` fica ANTES do transform para que o
 * valor padrao tambem atravesse a normalizacao e a validacao de URL.
 */
const originList = (fallback: string) =>
  z
    .string()
    .default(fallback)
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.url()).min(1, 'Informe ao menos uma origem valida em API_CORS_ORIGINS.'));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3333),
  API_CORS_ORIGINS: originList('http://localhost:3000'),
  API_BODY_LIMIT: z.string().default('256kb'),
  API_RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60_000),
  API_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  API_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuracao invalida: ${issues}`);
  }

  return result.data;
}

export const ENV = Symbol('APP_ENV');
