/**
 * Motor de pontuacao (PRD 8.7, RF-07).
 *
 * Tudo aqui e puro e deterministico: mesma entrada e mesma versao de regra
 * produzem sempre o mesmo resultado, e o resultado carrega os dados que o
 * explicam. PRD 8.7 proibe que uma inferencia decida numeros — um LLM pode, no
 * maximo, reescrever a explicacao em linguagem simples, sem tocar nos valores.
 *
 * O motor nao conhece banco, HTTP nem relogio.
 */

/** Um criterio da regua vigente naquela versao. */
export interface ScoringCriterion {
  /** `perg_id` da origem: estavel entre processos. */
  readonly code: number;
  readonly text: string;
  readonly order: number;
  readonly points: number;
  /** Criterio de desempate nao soma pontos; ordena empates (PRD 8.7). */
  readonly isTiebreak: boolean;
}

/**
 * Como a confirmacao entra na conta.
 *
 * As bases historicas guardam `resposta` e `confirmado` como campos
 * independentes — ha 472 mil linhas com resposta "Nao" e confirmacao "Sim" —, e
 * o dicionario de dados nao define o que a confirmacao significa. Em vez de
 * adivinhar, a politica e **parte da regra versionada** e viaja no resultado
 * (ADR-0038).
 */
export const CONFIRMATION_POLICIES = ['DECLARADA', 'CONFIRMADA'] as const;
export type ConfirmationPolicy = (typeof CONFIRMATION_POLICIES)[number];

export interface ScoringRule {
  readonly processCode: string;
  readonly version: number;
  /** `DEMONSTRACAO` enquanto a regra oficial de 2026 nao existir (B-07). */
  readonly status: 'DEMONSTRACAO' | 'OFICIAL';
  /** Ano do processo de onde a regua foi derivada. */
  readonly sourceYear: number;
  readonly confirmationPolicy: ConfirmationPolicy;
  readonly criteria: readonly ScoringCriterion[];
}

export interface CriterionAnswer {
  readonly code: number;
  readonly answer: boolean;
  readonly confirmed: boolean;
}

/** Por que um criterio somou, ou nao somou. Codigo estavel; a interface redige. */
export type ScoreLineOutcome =
  | 'PONTUOU'
  | 'RESPOSTA_NEGATIVA'
  | 'NAO_RESPONDIDA'
  | 'AGUARDA_CONFIRMACAO'
  | 'CRITERIO_DE_DESEMPATE';

export interface ScoreLine {
  readonly code: number;
  readonly text: string;
  readonly order: number;
  /** Peso do criterio na regua; zero nos criterios de desempate. */
  readonly weight: number;
  /** Pontos efetivamente somados por este criterio. */
  readonly awarded: number;
  readonly answer: boolean | null;
  readonly confirmed: boolean;
  readonly outcome: ScoreLineOutcome;
}

export interface TiebreakLine {
  readonly code: number;
  readonly text: string;
  readonly order: number;
  /** `true` quando o criterio favorece a inscricao no desempate. */
  readonly applies: boolean;
}

export interface ScoreOutcome {
  readonly total: number;
  /** Soma dos pesos da regua. Permite ler o total como fracao do maximo. */
  readonly maxTotal: number;
  readonly lines: readonly ScoreLine[];
  /** Na ordem da regua: o primeiro criterio decide primeiro (PRD 8.7). */
  readonly tiebreaks: readonly TiebreakLine[];
  readonly rule: {
    readonly processCode: string;
    readonly version: number;
    readonly status: 'DEMONSTRACAO' | 'OFICIAL';
    readonly sourceYear: number;
    readonly confirmationPolicy: ConfirmationPolicy;
  };
}

/**
 * Calcula a pontuacao.
 *
 * Criterio sem resposta nao pontua e **nao e erro**: a familia pode nao ter
 * respondido ainda, e o resultado parcial precisa ser exibivel para que ela veja
 * o que falta.
 */
export function score(rule: ScoringRule, answers: readonly CriterionAnswer[]): ScoreOutcome {
  const byCode = new Map(answers.map((answer) => [answer.code, answer]));
  const ordered = [...rule.criteria].sort((a, b) => a.order - b.order);

  const lines = ordered
    .filter((criterion) => !criterion.isTiebreak)
    .map((criterion) => toLine(criterion, byCode.get(criterion.code), rule.confirmationPolicy));

  const tiebreaks = ordered
    .filter((criterion) => criterion.isTiebreak)
    .map((criterion) => {
      const answer = byCode.get(criterion.code);
      return {
        code: criterion.code,
        text: criterion.text,
        order: criterion.order,
        applies: awards(answer, rule.confirmationPolicy),
      };
    });

  return {
    total: lines.reduce((sum, line) => sum + line.awarded, 0),
    maxTotal: maxTotalFor(rule),
    lines,
    tiebreaks,
    rule: {
      processCode: rule.processCode,
      version: rule.version,
      status: rule.status,
      sourceYear: rule.sourceYear,
      confirmationPolicy: rule.confirmationPolicy,
    },
  };
}

/** Soma dos pesos da regua vigente. */
export function maxTotalFor(rule: ScoringRule): number {
  return rule.criteria.reduce((sum, criterion) => sum + criterion.points, 0);
}

function toLine(
  criterion: ScoringCriterion,
  answer: CriterionAnswer | undefined,
  policy: ConfirmationPolicy,
): ScoreLine {
  const base = {
    code: criterion.code,
    text: criterion.text,
    order: criterion.order,
    weight: criterion.points,
    answer: answer?.answer ?? null,
    confirmed: answer?.confirmed ?? false,
  };

  if (answer === undefined) {
    return { ...base, awarded: 0, outcome: 'NAO_RESPONDIDA' };
  }
  if (!answer.answer) {
    return { ...base, awarded: 0, outcome: 'RESPOSTA_NEGATIVA' };
  }
  if (policy === 'CONFIRMADA' && !answer.confirmed) {
    return { ...base, awarded: 0, outcome: 'AGUARDA_CONFIRMACAO' };
  }
  return { ...base, awarded: criterion.points, outcome: 'PONTUOU' };
}

function awards(answer: CriterionAnswer | undefined, policy: ConfirmationPolicy): boolean {
  if (answer === undefined || !answer.answer) return false;
  return policy === 'DECLARADA' || answer.confirmed;
}

/**
 * Ordem de classificacao entre duas inscricoes ja pontuadas.
 *
 * Maior total primeiro; empate resolvido pelos criterios de desempate, na ordem
 * da regua. B-07 registra que os desempates oficiais nao foram confirmados —
 * usar a ordem da propria regua e a escolha mais defensavel disponivel, e ela
 * vive no dado versionado, nao no codigo.
 *
 * Devolve `0` quando nem os desempates separam: a decisao final e da Fase 8, que
 * precisa de um criterio estavel e auditavel para nao depender da ordem de
 * leitura do banco.
 */
export function compareForRanking(a: ScoreOutcome, b: ScoreOutcome): number {
  if (a.total !== b.total) return b.total - a.total;

  for (let index = 0; index < a.tiebreaks.length; index += 1) {
    const left = a.tiebreaks[index];
    const right = b.tiebreaks[index];
    if (left === undefined || right === undefined) break;
    if (left.applies !== right.applies) return left.applies ? -1 : 1;
  }

  return 0;
}
