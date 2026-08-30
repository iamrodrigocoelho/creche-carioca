/**
 * Normalizacoes puras aplicadas na fronteira de leitura (PRD 10.3).
 *
 * Tudo aqui e sincrono e sem I/O para poder ser testado sem DuckDB. As mesmas
 * regras sao reescritas como SQL em `sources.ts`; os testes comparam as duas
 * implementacoes sobre as fixtures para que nao divirjam.
 */

/** Larguras canonicas do `esc_codigo` por familia de unidade. */
export const PARTNER_CODE_WIDTH = 5;
export const PUBLIC_CODE_WIDTH = 7;

/**
 * Normaliza o codigo da unidade escolar preservando zeros a esquerda.
 *
 * As fontes discordam da largura: a Query A grava 5 digitos para creches
 * parceiras e 7 para unidades publicas, enquanto o `Unidades_Unificadas` veio de
 * uma planilha Excel que armazenou o codigo como numero e comeu os zeros — la
 * aparecem larguras de 4 a 7. Reancorar pela largura observada reconstroi a
 * chave: 852 das 872 unidades da Query A casam, sem nenhuma colisao.
 */
export function normalizeUnitCode(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').trim();
  if (digits === '' || !/^\d+$/.test(digits)) return null;
  const width = digits.length <= PARTNER_CODE_WIDTH ? PARTNER_CODE_WIDTH : PUBLIC_CODE_WIDTH;
  if (digits.length > width) return null;
  return digits.padStart(width, '0');
}

/**
 * Converte os marcadores de ausencia das extracoes em `null`.
 *
 * As bases gravam ausencia como a string literal `NULL` (nao como campo vazio),
 * e a Query D usa as duas formas no mesmo arquivo.
 */
export function nullify(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (value === '' || value.toUpperCase() === 'NULL') return null;
  return value;
}

/** Colapsa espacos internos e remove os das bordas, preservando acentuacao. */
export function normalizeText(raw: string | null | undefined): string | null {
  const value = nullify(raw);
  return value === null ? null : value.replace(/\s+/g, ' ');
}

/** CEP normalizado para 8 digitos, preservando zeros a esquerda. */
export function normalizeCep(raw: string | null | undefined): string | null {
  const value = nullify(raw);
  if (value === null) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0 || digits.length > 8) return null;
  return digits.padStart(8, '0');
}

/** Caixa delimitadora do municipio do Rio de Janeiro, para sanidade de coordenadas. */
export const RIO_BOUNDS = { minLat: -23.1, maxLat: -22.7, minLon: -43.8, maxLon: -43.1 } as const;

export function parseCoordinate(raw: string | null | undefined): number | null {
  const value = nullify(raw);
  if (value === null) return null;
  // A planilha usa ponto decimal; toleramos virgula para nao depender do locale.
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isWithinRio(lat: number | null, lon: number | null): boolean {
  if (lat === null || lon === null) return false;
  return (
    lat >= RIO_BOUNDS.minLat &&
    lat <= RIO_BOUNDS.maxLat &&
    lon >= RIO_BOUNDS.minLon &&
    lon <= RIO_BOUNDS.maxLon
  );
}
