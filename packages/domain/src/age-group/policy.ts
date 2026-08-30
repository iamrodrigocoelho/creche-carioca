/**
 * Politica de grupamento etario.
 *
 * PRD 8.1 exige que o grupamento seja calculado por "funcao de dominio testavel e
 * parametrizada". A politica abaixo e DADO, nao codigo: cada processo seletivo
 * carrega sua propria versao imutavel, coerente com `RuleVersion` (PRD 11).
 *
 * PRD 21 mantem em aberto a confirmacao das regras oficiais por processo. Por isso
 * a politica embarcada aqui esta marcada como `DEMONSTRACAO` e NAO pode ser
 * apresentada como retrato oficial da SME (PRD 1.2).
 */

export const AGE_GROUP_CODES = ['BERCARIO_I', 'BERCARIO_II', 'MATERNAL_I', 'MATERNAL_II'] as const;

export type AgeGroupCode = (typeof AGE_GROUP_CODES)[number];

/** Faixa de idade, em meses completos na data de referencia. Limites inclusivos. */
export interface AgeGroupBand {
  readonly code: AgeGroupCode;
  readonly label: string;
  readonly minAgeMonths: number;
  readonly maxAgeMonths: number;
}

/**
 * `DEMONSTRACAO` sinaliza dado sintetico/provisorio; `OFICIAL` so pode ser usado
 * apos validacao da SME (PRD 21).
 */
export type PolicyStatus = 'DEMONSTRACAO' | 'OFICIAL';

export interface AgeGroupPolicy {
  readonly id: string;
  readonly version: number;
  readonly status: PolicyStatus;
  readonly processId: string;
  /** Data de corte no formato `YYYY-MM-DD`. Sobrescrivel por chamada. */
  readonly referenceDate: string;
  readonly bands: readonly AgeGroupBand[];
  /** Origem declarada da regra, para rastreabilidade e auditoria. */
  readonly source: string;
}

/**
 * Politica de demonstracao do processo 2026.
 *
 * Faixas derivadas da descricao de escopo do PRD 2 ("aproximadamente 6 meses a
 * 3 anos"). Os limites exatos e a data de corte oficial permanecem pendentes de
 * confirmacao pela SME (PRD 21, linha "Desempates"/regras por processo).
 */
export const DEMO_AGE_GROUP_POLICY_2026: AgeGroupPolicy = {
  id: 'age-group-policy-demo-2026',
  version: 1,
  status: 'DEMONSTRACAO',
  processId: 'DEMO-2026',
  referenceDate: '2026-03-31',
  source: 'Dado de demonstracao do MVP. Pendente de confirmacao oficial (PRD 21).',
  bands: [
    { code: 'BERCARIO_I', label: 'Berçário I', minAgeMonths: 6, maxAgeMonths: 11 },
    { code: 'BERCARIO_II', label: 'Berçário II', minAgeMonths: 12, maxAgeMonths: 23 },
    { code: 'MATERNAL_I', label: 'Maternal I', minAgeMonths: 24, maxAgeMonths: 35 },
    { code: 'MATERNAL_II', label: 'Maternal II', minAgeMonths: 36, maxAgeMonths: 47 },
  ],
};

/** Catalogo de politicas conhecidas, indexado por processo. */
const POLICIES_BY_PROCESS: Readonly<Record<string, AgeGroupPolicy>> = {
  [DEMO_AGE_GROUP_POLICY_2026.processId]: DEMO_AGE_GROUP_POLICY_2026,
};

export function findAgeGroupPolicy(processId: string): AgeGroupPolicy | undefined {
  return POLICIES_BY_PROCESS[processId];
}

export function listAgeGroupPolicies(): readonly AgeGroupPolicy[] {
  return Object.values(POLICIES_BY_PROCESS);
}
