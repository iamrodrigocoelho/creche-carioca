import { DomainError } from '../errors';
import type { AgeGroupBand, AgeGroupPolicy } from './policy';

/**
 * Resolucao do grupamento etario a partir de mes/ano de nascimento (PRD 8.1).
 *
 * Funcao pura: nao le relogio, nao acessa I/O e nao depende de fuso horario.
 * A data de referencia e sempre explicita, o que torna o recalculo deterministico
 * quando o nascimento OU a data de referencia mudam.
 */

export interface CalendarDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

/**
 * Passo de explicacao estruturado. PRD 8.7 exige que a explicacao seja gerada a
 * partir de dados estruturados, nunca inferida por LLM. `values` carrega apenas
 * numeros e rotulos nao sensiveis; `summary` e uma renderizacao deterministica
 * em pt-BR desses mesmos valores.
 */
export interface ExplanationStep {
  readonly code:
    | 'BIRTH_INPUT'
    | 'REFERENCE_DATE'
    | 'AGE_IN_MONTHS'
    | 'BAND_MATCHED'
    | 'BELOW_MINIMUM_AGE'
    | 'ABOVE_MAXIMUM_AGE';
  readonly values: Readonly<Record<string, string | number>>;
  readonly summary: string;
}

export type AgeGroupOutcome = 'MATCHED' | 'BELOW_MINIMUM_AGE' | 'ABOVE_MAXIMUM_AGE';

export interface AgeGroupResolution {
  readonly outcome: AgeGroupOutcome;
  /** Faixa correspondente; `null` quando a idade esta fora do atendimento de creche. */
  readonly band: AgeGroupBand | null;
  readonly ageInMonths: number;
  readonly referenceDate: string;
  readonly policy: {
    readonly id: string;
    readonly version: number;
    readonly status: AgeGroupPolicy['status'];
    readonly processId: string;
  };
  readonly explanation: readonly ExplanationStep[];
}

export interface ResolveAgeGroupInput {
  readonly birthYear: number;
  readonly birthMonth: number;
  readonly policy: AgeGroupPolicy;
  /**
   * Sobrescreve `policy.referenceDate` no formato `YYYY-MM-DD`.
   * PRD 8.1: alterar a data de referencia deve recalcular o grupamento.
   */
  readonly referenceDate?: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Menor ano de nascimento aceito. Evita entradas absurdas sem inventar regra de negocio. */
const MIN_BIRTH_YEAR = 1900;
/** Folga acima do ano de referencia para tolerar datas de corte no inicio do ano. */
const MAX_BIRTH_YEAR_LOOKAHEAD = 1;

export function parseIsoDate(value: string): CalendarDate {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new DomainError(
      'INVALID_REFERENCE_DATE',
      'Data de referencia deve estar no formato YYYY-MM-DD.',
      { received: value },
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // Rejeita datas sintaticamente validas mas inexistentes (ex.: 2026-02-31).
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new DomainError(
      'INVALID_REFERENCE_DATE',
      'Data de referencia inexistente no calendario.',
      {
        received: value,
      },
    );
  }

  return { year, month, day };
}

/**
 * Meses completos entre o nascimento e a data de referencia.
 *
 * O dataset guarda apenas mes e ano de nascimento (PRD 8.1), entao a crianca e
 * tratada como nascida no primeiro dia do mes informado. Com isso o dia da data
 * de referencia nunca subtrai um mes, e o calculo permanece deterministico.
 */
export function ageInMonthsAt(
  birthYear: number,
  birthMonth: number,
  reference: CalendarDate,
): number {
  return (reference.year - birthYear) * 12 + (reference.month - birthMonth);
}

function assertValidPolicy(policy: AgeGroupPolicy): void {
  if (policy.bands.length === 0) {
    throw new DomainError('INVALID_POLICY', 'Politica de grupamento sem faixas definidas.', {
      policyId: policy.id,
    });
  }

  const ordered = [...policy.bands].sort((a, b) => a.minAgeMonths - b.minAgeMonths);
  for (const [index, band] of ordered.entries()) {
    if (band.minAgeMonths > band.maxAgeMonths) {
      throw new DomainError('INVALID_POLICY', 'Faixa de grupamento com limites invertidos.', {
        policyId: policy.id,
        band: band.code,
      });
    }
    const previous = index > 0 ? ordered[index - 1] : undefined;
    if (previous && band.minAgeMonths <= previous.maxAgeMonths) {
      throw new DomainError('INVALID_POLICY', 'Faixas de grupamento sobrepostas.', {
        policyId: policy.id,
        band: band.code,
        previousBand: previous.code,
      });
    }
  }
}

function assertValidBirth(birthYear: number, birthMonth: number, reference: CalendarDate): void {
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) {
    throw new DomainError('INVALID_BIRTH_MONTH', 'Mes de nascimento deve estar entre 1 e 12.', {
      received: birthMonth,
    });
  }
  if (!Number.isInteger(birthYear)) {
    throw new DomainError('INVALID_BIRTH_YEAR', 'Ano de nascimento deve ser um numero inteiro.', {
      received: birthYear,
    });
  }
  if (birthYear < MIN_BIRTH_YEAR || birthYear > reference.year + MAX_BIRTH_YEAR_LOOKAHEAD) {
    throw new DomainError('INVALID_BIRTH_YEAR', 'Ano de nascimento fora do intervalo aceito.', {
      received: birthYear,
      minimum: MIN_BIRTH_YEAR,
      maximum: reference.year + MAX_BIRTH_YEAR_LOOKAHEAD,
    });
  }
}

/** Texto apresentado a familia; PRD 17 pede linguagem simples e correta. */
function formatMonths(months: number): string {
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(years === 1 ? '1 ano' : `${years} anos`);
  if (remaining > 0) parts.push(remaining === 1 ? '1 mês' : `${remaining} meses`);
  return parts.length > 0 ? parts.join(' e ') : '0 mês';
}

export function resolveAgeGroup(input: ResolveAgeGroupInput): AgeGroupResolution {
  const { birthYear, birthMonth, policy } = input;

  assertValidPolicy(policy);

  const referenceDate = input.referenceDate ?? policy.referenceDate;
  const reference = parseIsoDate(referenceDate);

  assertValidBirth(birthYear, birthMonth, reference);

  const ageInMonths = ageInMonthsAt(birthYear, birthMonth, reference);

  const ordered = [...policy.bands].sort((a, b) => a.minAgeMonths - b.minAgeMonths);
  const lowest = ordered[0] as AgeGroupBand;
  const highest = ordered[ordered.length - 1] as AgeGroupBand;
  const matched = ordered.find(
    (band) => ageInMonths >= band.minAgeMonths && ageInMonths <= band.maxAgeMonths,
  );

  const explanation: ExplanationStep[] = [
    {
      code: 'BIRTH_INPUT',
      values: { birthYear, birthMonth },
      summary: `Nascimento informado: ${String(birthMonth).padStart(2, '0')}/${birthYear}.`,
    },
    {
      code: 'REFERENCE_DATE',
      values: { referenceDate, policyId: policy.id, policyVersion: policy.version },
      summary: `Data de referência aplicada: ${referenceDate} (regra ${policy.id} v${policy.version}).`,
    },
    {
      code: 'AGE_IN_MONTHS',
      values: { ageInMonths },
      summary: `Idade completa na data de referência: ${formatMonths(ageInMonths)} (${ageInMonths} meses).`,
    },
  ];

  if (matched) {
    explanation.push({
      code: 'BAND_MATCHED',
      values: {
        band: matched.code,
        bandLabel: matched.label,
        minAgeMonths: matched.minAgeMonths,
        maxAgeMonths: matched.maxAgeMonths,
      },
      summary: `${ageInMonths} meses está na faixa de ${matched.minAgeMonths} a ${matched.maxAgeMonths} meses, que corresponde ao grupamento ${matched.label}.`,
    });
  } else if (ageInMonths < lowest.minAgeMonths) {
    explanation.push({
      code: 'BELOW_MINIMUM_AGE',
      values: { ageInMonths, minAgeMonths: lowest.minAgeMonths },
      summary: `Na data de referência a criança terá ${formatMonths(ageInMonths)}, abaixo da idade mínima de ${lowest.minAgeMonths} meses atendida por creche nesta regra.`,
    });
  } else {
    explanation.push({
      code: 'ABOVE_MAXIMUM_AGE',
      values: { ageInMonths, maxAgeMonths: highest.maxAgeMonths },
      summary: `Na data de referência a criança terá ${formatMonths(ageInMonths)}, acima da idade máxima de ${highest.maxAgeMonths} meses atendida por creche nesta regra.`,
    });
  }

  return {
    outcome: matched
      ? 'MATCHED'
      : ageInMonths < lowest.minAgeMonths
        ? 'BELOW_MINIMUM_AGE'
        : 'ABOVE_MAXIMUM_AGE',
    band: matched ?? null,
    ageInMonths,
    referenceDate,
    policy: {
      id: policy.id,
      version: policy.version,
      status: policy.status,
      processId: policy.processId,
    },
    explanation,
  };
}
