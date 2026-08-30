/**
 * Tipos dos pontos de referencia (PRD 8.2).
 *
 * Vivem no dominio porque a recomendacao da Fase 6 precisa distinguir a
 * residencia dos demais pontos, e o dominio nao pode depender de `@match/schemas`
 * — a dependencia corre no outro sentido.
 */
export const ANCHOR_KINDS = ['RESIDENCIA', 'TRABALHO', 'REDE_APOIO', 'OUTRO'] as const;
export type AnchorKind = (typeof ANCHOR_KINDS)[number];

/** Posicao 1 e a residencia; 2 e 3 sao os pontos opcionais de PRD 8.2. */
export const MIN_ANCHOR_POSITION = 1;
export const MAX_ANCHOR_POSITION = 3;
export const RESIDENCE_POSITION = 1;
