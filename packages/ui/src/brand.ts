/**
 * Ativos oficiais de marca.
 *
 * DESIGN.md, Brand Assets: `/img/logo` e a UNICA fonte autorizada de logotipos.
 * Os arquivos servidos em `/img/logo/` sao derivados dos originais por
 * `scripts/build-brand-assets.py`, que apenas recorta a silhueta da marca e
 * descarta o fundo de apresentacao do mockup (textura de papel, tracos
 * decorativos e o xadrez de falsa transparencia). Nenhuma cor, proporcao ou
 * composicao da marca foi alterada. Ver docs/DECISIONS.md (ADR-0027).
 *
 * As variantes "Prefeitura Rio Educacao" isoladas permanecem no repositorio,
 * mas a aplicacao usa a marca do programa, que ja embute a assinatura
 * institucional. Nao inventar variantes novas.
 */

export interface BrandLogo {
  /** Caminho absoluto a partir da raiz publica, ja codificado para URL. */
  readonly src: string;
  /** Dimensoes intrinsecas do arquivo, usadas para preservar a proporcao original. */
  readonly intrinsicWidth: number;
  readonly intrinsicHeight: number;
  /** Fundo para o qual a variante foi desenhada. */
  readonly intendedBackground: 'light' | 'dark' | 'any';
}

/**
 * Placa horizontal do programa. Fundo proprio em azul solido, o que a torna
 * legivel tanto sobre {colors.surface-tile-1} quanto sobre {colors.canvas} —
 * por isso a area de protecao clara do ADR-0008 deixou de ser necessaria.
 */
export const LOGO_CRECHE_CARIOCA_HEADER: BrandLogo = {
  src: '/img/logo/crechecarioca-header.png',
  intrinsicWidth: 305,
  intrinsicHeight: 120,
  intendedBackground: 'any',
};

/** Selo circular do programa, usado no rodape. */
export const LOGO_CRECHE_CARIOCA_FOOTER: BrandLogo = {
  src: '/img/logo/crechecarioca-footer.png',
  intrinsicWidth: 288,
  intrinsicHeight: 288,
  intendedBackground: 'any',
};

/**
 * DESIGN.md: todo uso informativo do logotipo precisa de texto alternativo
 * adequado. A marca do programa carrega a assinatura institucional, entao o
 * texto alternativo nomeia as duas coisas.
 */
export const BRAND_ALT_TEXT = 'Creche Carioca - Prefeitura da Cidade do Rio de Janeiro, Educação';
