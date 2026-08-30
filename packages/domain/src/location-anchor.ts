/**
 * Regras puras dos pontos de referencia (PRD 8.2).
 *
 * Vivem no dominio porque duas execucoes diferentes precisam do mesmo
 * comportamento: o servico da API, contra PostgreSQL, e o build estatico, que
 * roda inteiramente no navegador sem servidor (ADR-0027). Reimplementar em cada
 * lado faria a mesma familia ver resultados diferentes conforme a versao.
 */

export const ANCHOR_KINDS = ['RESIDENCIA', 'TRABALHO', 'REDE_APOIO', 'OUTRO'] as const;
export type AnchorKind = (typeof ANCHOR_KINDS)[number];

/** Posicao 1 e a residencia; 2 e 3 sao os pontos opcionais de PRD 8.2. */
export const MIN_ANCHOR_POSITION = 1;
export const MAX_ANCHOR_POSITION = 3;
export const RESIDENCE_POSITION = 1;

/** Codigos estaveis, reaproveitados pela API e pelo modo estatico. */
export type AnchorRuleViolation = 'ANCHOR_POSITION_MISMATCH' | 'ANCHOR_LIMIT_REACHED';

export type AnchorPositionResult =
  | { readonly ok: true; readonly position: number }
  | { readonly ok: false; readonly violation: AnchorRuleViolation };

/**
 * Decide em que posicao o ponto entra.
 *
 * Sem posicao explicita, ocupa a primeira livre. A posicao 1 e sempre a
 * residencia, e a residencia so cabe na posicao 1 — as duas direcoes da mesma
 * regra, porque a familia pode chegar por qualquer uma delas.
 */
export function resolveAnchorPosition(input: {
  readonly requested: number | undefined;
  readonly kind: AnchorKind;
  readonly taken: readonly number[];
}): AnchorPositionResult {
  const position = input.requested ?? nextFreePosition(input.taken);
  if (position === undefined) return { ok: false, violation: 'ANCHOR_LIMIT_REACHED' };

  const isResidence = input.kind === 'RESIDENCIA';
  if ((position === RESIDENCE_POSITION) !== isResidence) {
    return { ok: false, violation: 'ANCHOR_POSITION_MISMATCH' };
  }

  return { ok: true, position };
}

function nextFreePosition(taken: readonly number[]): number | undefined {
  const used = new Set(taken);
  for (let position = MIN_ANCHOR_POSITION; position <= MAX_ANCHOR_POSITION; position += 1) {
    if (!used.has(position)) return position;
  }
  return undefined;
}

/**
 * Marca CEP repetido apontando para a primeira ocorrencia.
 *
 * PRD 8.2 manda **sinalizar**, nao recusar (ADR-0026): repetir um CEP entre
 * residencia e trabalho e uma escolha legitima de quem trabalha em casa.
 */
export function flagDuplicateCeps<T extends { readonly position: number; readonly cep: string }>(
  anchors: readonly T[],
): (T & { readonly duplicateOfPosition: number | null })[] {
  const firstByCep = new Map<string, number>();

  return anchors.map((anchor) => {
    const firstPosition = firstByCep.get(anchor.cep);
    if (firstPosition === undefined) firstByCep.set(anchor.cep, anchor.position);
    return { ...anchor, duplicateOfPosition: firstPosition ?? null };
  });
}
