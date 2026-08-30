/**
 * Invariantes dos contatos (PRD 8.3, 8.4).
 *
 * Puras e sem I/O: a API as aplica antes de gravar, e a interface as usa para
 * saber o que oferecer. Nenhuma delas depende de banco, e por isso podem ser
 * testadas exaustivamente.
 */

export const CONTACT_CHANNELS = ['TELEFONE', 'EMAIL', 'SOCIAL'] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const SOCIAL_PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'X'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * Estados de PRD 8.4. Valem tambem para telefone, onde `VERIFIED` e o resultado
 * do OTP simulado.
 */
export const CONTACT_STATUSES = [
  'INFORMED',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'INVALID',
  'REVOKED',
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** Relacao com a crianca. PRD 8.3 exige registrar titular ou relacao. */
export const CONTACT_RELATIONS = [
  'RESPONSAVEL',
  'MAE',
  'PAI',
  'FAMILIAR',
  'VIZINHO',
  'OUTRO',
] as const;
export type ContactRelation = (typeof CONTACT_RELATIONS)[number];

/**
 * Relacoes que caracterizam telefone de terceiro.
 *
 * PRD 8.3 exige relacao e confirmacao de autorizacao para esses numeros, e
 * PRD 21 registra o tema como pendencia de privacidade: ligar para o telefone
 * de outra pessoa sem que ela saiba e um problema real, nao burocracia.
 */
const THIRD_PARTY_RELATIONS = new Set<ContactRelation>(['FAMILIAR', 'VIZINHO', 'OUTRO']);

export function isThirdParty(relation: ContactRelation): boolean {
  return THIRD_PARTY_RELATIONS.has(relation);
}

export type ContactRuleViolation =
  | 'PHONE_REQUIRED'
  | 'LAST_PHONE_CANNOT_BE_REMOVED'
  | 'THIRD_PARTY_AUTHORIZATION_REQUIRED'
  | 'SOCIAL_CANNOT_BE_ONLY_CONTACT'
  | 'PRIMARY_MUST_BE_PHONE';

/** O minimo que uma regra precisa saber sobre um contato ja gravado. */
export interface ContactSummary {
  readonly id: string;
  readonly channel: ContactChannel;
  readonly isPrimary: boolean;
  readonly fingerprint: string;
}

export function phonesAmong(contacts: readonly ContactSummary[]): ContactSummary[] {
  return contacts.filter((contact) => contact.channel === 'TELEFONE');
}

/**
 * PRD 8.3: nao deve ser possivel remover o unico telefone.
 *
 * Vale para o unico telefone mesmo que existam perfis sociais, porque PRD 8.4
 * proibe rede social como unico contato — remover deixaria a familia
 * inalcancavel por um canal que a SME de fato usa.
 */
export function canRemoveContact(
  contacts: readonly ContactSummary[],
  id: string,
): { readonly ok: true } | { readonly ok: false; readonly violation: ContactRuleViolation } {
  const target = contacts.find((contact) => contact.id === id);
  if (target === undefined || target.channel !== 'TELEFONE') return { ok: true };

  if (phonesAmong(contacts).length <= 1) {
    return { ok: false, violation: 'LAST_PHONE_CANNOT_BE_REMOVED' };
  }
  return { ok: true };
}

/**
 * PRD 8.4: rede social nunca pode ser o unico contato.
 *
 * Checado na leitura, e nao so na escrita, para que a interface consiga dizer o
 * que ainda falta em vez de so recusar no fim.
 */
export function hasReachableContact(contacts: readonly ContactSummary[]): boolean {
  return phonesAmong(contacts).length > 0;
}

/**
 * Decide quem e o principal apos uma mudanca.
 *
 * PRD 8.3 exige **exatamente um** principal. Duas situacoes precisam de conserto
 * automatico, senao o estado fica invalido sem que ninguem tenha errado: marcar
 * um novo principal precisa desmarcar o anterior, e remover o principal precisa
 * promover outro. O primeiro telefone entra como principal por definicao.
 */
export function reconcilePrimary(
  contacts: readonly ContactSummary[],
  preferredId?: string,
): readonly { readonly id: string; readonly isPrimary: boolean }[] {
  const phones = phonesAmong(contacts);
  if (phones.length === 0) return contacts.map(({ id }) => ({ id, isPrimary: false }));

  const preferred =
    phones.find((phone) => phone.id === preferredId) ??
    phones.find((phone) => phone.isPrimary) ??
    phones[0];

  return contacts.map((contact) => ({
    id: contact.id,
    // So telefone pode ser principal: e por ele que a convocacao acontece.
    isPrimary: contact.channel === 'TELEFONE' && contact.id === preferred?.id,
  }));
}

/**
 * Marca contatos repetidos apontando para o primeiro.
 *
 * PRD 8.3 manda **sinalizar** telefone duplicado, nao recusar — a mesma escolha
 * feita para CEP na Fase 4. Compara pelo indice cego, nunca pelo valor.
 */
export function flagDuplicateContacts<
  T extends { readonly id: string; readonly fingerprint: string },
>(contacts: readonly T[]): (T & { readonly duplicateOfId: string | null })[] {
  const firstByFingerprint = new Map<string, string>();

  return contacts.map((contact) => {
    const first = firstByFingerprint.get(contact.fingerprint);
    if (first === undefined) firstByFingerprint.set(contact.fingerprint, contact.id);
    return { ...contact, duplicateOfId: first ?? null };
  });
}

/**
 * Normaliza `@handle` de rede social.
 *
 * PRD 8.4 trata o handle como **mutavel**, entao ele nunca serve de chave: o
 * identificador interno da plataforma e que serve, quando houver. Aqui so se
 * remove o arroba e o espaco, preservando a caixa que a pessoa escolheu.
 */
export function normalizeHandle(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim().replace(/^@+/, '');
  if (value === '') return null;
  // Conjunto conservador comum as quatro plataformas de PRD 8.4.
  if (!/^[A-Za-z0-9._]{1,30}$/.test(value)) return null;
  return value;
}

/** Exibicao do handle, sempre com arroba. */
export function formatHandle(handle: string): string {
  return `@${handle}`;
}

/**
 * Mascara o handle para exibicao padrao (PRD 13.4).
 *
 * Mantem as duas primeiras letras: o bastante para a familia reconhecer qual
 * perfil e aquele. Handles muito curtos ficam inteiramente cobertos, porque
 * revelar dois de tres caracteres nao mascara nada.
 */
export function maskHandle(handle: string): string {
  if (handle.length <= 3) return `@${'•'.repeat(handle.length)}`;
  return `@${handle.slice(0, 2)}${'•'.repeat(handle.length - 2)}`;
}
