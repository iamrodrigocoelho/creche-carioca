/**
 * Ativos oficiais de marca.
 *
 * DESIGN.md, Brand Assets: `/img/logo` e a UNICA fonte autorizada de logotipos.
 * Os nomes abaixo foram obtidos por inspecao do diretorio e nao podem ser
 * renomeados, recolorados, mascarados ou redesenhados. Os arquivos sao servidos
 * a partir da raiz publica em `/img/logo/`.
 *
 * TODO (DESIGN.md, Brand Assets): nao existe variante negativa/branca para fundo
 * azul. Enquanto ela nao for fornecida pela Prefeitura, a navegacao azul usa a
 * variante horizontal sobre area de protecao clara. Ver docs/DECISIONS.md
 * (ADR-0008). Nenhuma variante nova deve ser inventada.
 */

export interface BrandLogo {
  /** Caminho absoluto a partir da raiz publica, ja codificado para URL. */
  readonly src: string;
  /** Dimensoes intrinsecas do arquivo, usadas para preservar a proporcao original. */
  readonly intrinsicWidth: number;
  readonly intrinsicHeight: number;
  /** Fundo para o qual a variante foi desenhada. */
  readonly intendedBackground: 'light' | 'dark';
}

export const LOGO_HORIZONTAL_BLACK: BrandLogo = {
  src: encodeURI('/img/logo/RIOPREFEITURA Educação horizontal monocromática preto.png'),
  intrinsicWidth: 1490,
  intrinsicHeight: 310,
  intendedBackground: 'light',
};

export const LOGO_VERTICAL_BLUE: BrandLogo = {
  src: encodeURI('/img/logo/RIO PREFEITURA Educação vertical monocromática azul.png'),
  intrinsicWidth: 478,
  intrinsicHeight: 787,
  intendedBackground: 'light',
};

/** DESIGN.md: todo uso informativo do logotipo precisa de texto alternativo adequado. */
export const BRAND_ALT_TEXT = 'Prefeitura da Cidade do Rio de Janeiro - Educação';

/** Nome do produto. Nao faz parte da marca institucional. */
export const PRODUCT_NAME = 'Match Perfeito';
