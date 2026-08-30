import {
  CONTACT_RELATIONS,
  CONTACT_STATUSES,
  isMobile,
  isThirdParty,
  normalizeE164,
  normalizeHandle,
  SOCIAL_PLATFORMS,
} from '@match/domain';
import { z } from 'zod';

/**
 * Contratos dos contatos (RF-03, RF-04).
 *
 * As respostas trazem o valor **mascarado** e nunca o completo. PRD 13.4 pede
 * contatos mascarados por padrao, e enquanto nao existir autenticacao (Fase 10,
 * B-05) nao ha ninguem a quem autorizar a ver o numero inteiro — um endpoint de
 * revelacao sem autorizacao seria pior que a ausencia dele.
 */

export const contactRelationSchema = z.enum(CONTACT_RELATIONS, {
  error: 'Informe a relação da pessoa com a criança.',
});
export const socialPlatformSchema = z.enum(SOCIAL_PLATFORMS, {
  error: 'Selecione a rede social.',
});
export const contactStatusSchema = z.enum(CONTACT_STATUSES);
export const contactChannelSchema = z.enum(['TELEFONE', 'SOCIAL']);

/** Aceita o que a familia digita e guarda E.164. */
export const phoneSchema = z
  .string({ error: 'Informe o telefone.' })
  .trim()
  .min(1, 'Informe o telefone.')
  .max(24, 'Telefone inválido.')
  .transform((value, ctx) => {
    const normalized = normalizeE164(value);
    if (normalized === null) {
      ctx.addIssue({ code: 'custom', message: 'Informe um telefone brasileiro com DDD.' });
      return z.NEVER;
    }
    return normalized;
  });

export const handleSchema = z
  .string({ error: 'Informe o perfil.' })
  .trim()
  .min(1, 'Informe o perfil.')
  .max(40, 'Perfil inválido.')
  .transform((value, ctx) => {
    const normalized = normalizeHandle(value);
    if (normalized === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Use apenas letras, números, ponto e sublinhado no perfil.',
      });
      return z.NEVER;
    }
    return normalized;
  });

/** Rotulo livre. Sem `<` e `>`: o campo e reexibido na interface (PRD 13.5). */
export const contactLabelSchema = z
  .string()
  .trim()
  .max(60, 'Use no máximo 60 caracteres no rótulo.')
  .regex(/^[^<>]*$/, 'O rótulo não pode conter os caracteres < ou >.');

export const contactPrioritySchema = z
  .number()
  .int('Prioridade inválida.')
  .min(1, 'Prioridade inválida.')
  .max(99, 'Prioridade inválida.');

export const createPhoneContactSchema = z
  .object({
    phone: phoneSchema,
    label: contactLabelSchema.optional(),
    relation: contactRelationSchema,
    /** Sem indicacao, a API decide: o primeiro telefone vira o principal. */
    isPrimary: z.boolean().optional(),
    priority: contactPrioritySchema.optional(),
    allowsCall: z.boolean().default(true),
    allowsSms: z.boolean().default(false),
    allowsWhatsapp: z.boolean().default(false),
    /** PRD 8.3: telefone de terceiro exige confirmacao de autorizacao. */
    thirdPartyAuthorized: z.boolean().default(false),
  })
  .refine((value) => !isThirdParty(value.relation) || value.thirdPartyAuthorized, {
    path: ['thirdPartyAuthorized'],
    message: 'Confirme que a pessoa autorizou o uso do telefone dela.',
  })
  .refine((value) => isMobile(value.phone) || (!value.allowsSms && !value.allowsWhatsapp), {
    path: ['allowsSms'],
    message: 'SMS e WhatsApp só funcionam em telefone celular.',
  });

export const createSocialContactSchema = z.object({
  platform: socialPlatformSchema,
  handle: handleSchema,
  label: contactLabelSchema.optional(),
  priority: contactPrioritySchema.optional(),
  /** PRD 8.4: contato por rede social exige autorizacao explicita. */
  allowsSocial: z.boolean().default(false),
});

/** Confirmacao do OTP simulado (PRD 8.3). */
export const verifyContactSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'O código tem 6 dígitos.'),
});

export const contactPointSchema = z.object({
  id: z.uuid(),
  channel: contactChannelSchema,
  /**
   * Valor mascarado, como `(21) •••••-4321` ou `@ma••••`. O valor completo nunca
   * sai da API (PRD 13.4).
   */
  masked: z.string(),
  platform: socialPlatformSchema.nullable(),
  label: z.string().nullable(),
  relation: contactRelationSchema,
  isPrimary: z.boolean(),
  priority: z.number().int(),
  status: contactStatusSchema,
  allowsCall: z.boolean(),
  allowsSms: z.boolean(),
  allowsWhatsapp: z.boolean(),
  allowsSocial: z.boolean(),
  thirdPartyAuthorized: z.boolean(),
  /** Aponta para o primeiro contato com o mesmo valor. PRD 8.3 manda sinalizar. */
  duplicateOfId: z.uuid().nullable(),
  consentedAt: z.iso.datetime().nullable(),
  lastValidatedAt: z.iso.datetime().nullable(),
});

export const contactListSchema = z.object({
  applicationId: z.uuid(),
  contacts: z.array(contactPointSchema),
  /** `false` enquanto nao houver telefone: PRD 8.4 proibe social como unico. */
  hasReachableContact: z.boolean(),
});

/**
 * Resposta ao pedir verificacao. O codigo simulado vem no corpo **porque nao ha
 * envio de SMS** nesta demonstracao (B-06); mandar a familia adivinhar um codigo
 * que nunca chega seria pior. Nada disso vale para producao.
 */
export const contactChallengeSchema = z.object({
  contactId: z.uuid(),
  expiresAt: z.iso.datetime(),
  simulatedCode: z.string().regex(/^\d{6}$/),
  notice: z.string(),
});

export type ContactRelation = z.infer<typeof contactRelationSchema>;
export type SocialPlatform = z.infer<typeof socialPlatformSchema>;
export type ContactStatus = z.infer<typeof contactStatusSchema>;
export type CreatePhoneContactInput = z.input<typeof createPhoneContactSchema>;
export type CreatePhoneContactParsed = z.output<typeof createPhoneContactSchema>;
export type CreateSocialContactInput = z.input<typeof createSocialContactSchema>;
export type CreateSocialContactParsed = z.output<typeof createSocialContactSchema>;
export type VerifyContactInput = z.infer<typeof verifyContactSchema>;
export type ContactPointResponse = z.infer<typeof contactPointSchema>;
export type ContactListResponse = z.infer<typeof contactListSchema>;
export type ContactChallengeResponse = z.infer<typeof contactChallengeSchema>;
