/**
 * Telefone em E.164 (PRD 8.3).
 *
 * O escopo e o Brasil, e o formato de destino e `+55DDNNNNNNNNN`. A regra vive
 * no dominio porque a API valida na entrada e a interface precisa formatar para
 * exibicao — e um numero que normaliza diferente nos dois lados vira duplicata
 * que o sistema nao reconhece como tal.
 */

export const BRAZIL_COUNTRY_CODE = '55';

/** DDDs validos no Brasil. Nao ha DDD terminado em 0, nem faixa 20, 23, 25... */
const VALID_AREA_CODES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Normaliza para E.164, aceitando o que as pessoas realmente digitam.
 *
 * `(21) 98765-4321`, `21987654321`, `+55 21 98765-4321` e `5521987654321` sao a
 * mesma coisa. Devolve `null` quando nao ha telefone brasileiro reconhecivel —
 * quem chama decide se isso e erro de entrada ou ausencia.
 */
export function normalizeE164(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 0) return null;

  // Com o codigo do pais na frente, o resto tem de ser DDD + assinante.
  const national = digits.startsWith(BRAZIL_COUNTRY_CODE)
    ? digits.slice(BRAZIL_COUNTRY_CODE.length)
    : digits;

  // 10 digitos = fixo (DD + 8); 11 = movel (DD + 9). Nada mais e valido no Brasil.
  if (national.length !== 10 && national.length !== 11) return null;

  const areaCode = Number(national.slice(0, 2));
  if (!VALID_AREA_CODES.has(areaCode)) return null;

  const subscriber = national.slice(2);
  // Movel comeca com 9; fixo comeca de 2 a 5. Barrar isso evita gravar um numero
  // de 11 digitos que na verdade e um fixo com digito sobrando.
  if (subscriber.length === 9 && !subscriber.startsWith('9')) return null;
  if (subscriber.length === 8 && !/^[2-5]/.test(subscriber)) return null;

  return `+${BRAZIL_COUNTRY_CODE}${national}`;
}

/** `true` para movel, que e o que pode receber SMS e WhatsApp. */
export function isMobile(e164: string): boolean {
  return e164.length === 14;
}

/**
 * Formata para exibicao: `(21) 98765-4321`.
 *
 * Usar apenas quando a pessoa tiver direito de ver o numero inteiro. Para
 * listagem, ver `maskPhone` — PRD 13.4 exige contatos mascarados por padrao.
 */
export function formatPhone(e164: string): string {
  const national = e164.slice(3);
  const area = national.slice(0, 2);
  const subscriber = national.slice(2);
  const half = subscriber.length === 9 ? 5 : 4;
  return `(${area}) ${subscriber.slice(0, half)}-${subscriber.slice(half)}`;
}

/**
 * Mascara para exibicao padrao (PRD 13.4).
 *
 * Mantem o DDD e os quatro ultimos digitos: o suficiente para a familia
 * reconhecer qual dos seus numeros e aquele, sem expor o numero a quem olha a
 * tela por cima do ombro.
 */
export function maskPhone(e164: string): string {
  const national = e164.slice(3);
  const area = national.slice(0, 2);
  const last = national.slice(-4);
  return `(${area}) ${'•'.repeat(national.length - 6)}-${last}`;
}
