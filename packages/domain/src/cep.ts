/**
 * CEP como texto (PRD 10.3).
 *
 * A regra vive no dominio porque duas fronteiras precisam dela e nao podem
 * depender uma da outra: o pipeline de ingestao, ao normalizar as bases
 * historicas, e a API, ao validar o que a familia digita. Divergir faria o
 * mesmo CEP virar duas chaves diferentes.
 */

export const CEP_LENGTH = 8;

/** Prefixo de cinco digitos. E a granularidade da referencia de geocodificacao. */
export const CEP_SECTOR_LENGTH = 5;

/**
 * Normaliza para oito digitos, preservando zeros a esquerda.
 *
 * Aceita as formas que a familia digita (`20931-004`, `20931 004`) e as que as
 * bases historicas gravam. Devolve `null` quando nao ha CEP reconhecivel — o
 * chamador decide se isso e erro de entrada ou ausencia de dado.
 */
export function normalizeCep(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (value === '' || value.toUpperCase() === 'NULL') return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0 || digits.length > CEP_LENGTH) return null;
  return digits.padStart(CEP_LENGTH, '0');
}

/** Setor do CEP: os cinco primeiros digitos de um CEP ja normalizado. */
export function cepSector(cep: string): string {
  return cep.slice(0, CEP_SECTOR_LENGTH);
}

/** Formata para exibicao (`20931-004`). Nunca usar em log (PRD 13.4). */
export function formatCep(cep: string): string {
  return `${cep.slice(0, CEP_SECTOR_LENGTH)}-${cep.slice(CEP_SECTOR_LENGTH)}`;
}
