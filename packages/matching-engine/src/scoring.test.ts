import { describe, expect, it } from 'vitest';

import {
  compareForRanking,
  maxTotalFor,
  score,
  type ConfirmationPolicy,
  type CriterionAnswer,
  type ScoringRule,
} from './scoring';

/**
 * A régua de 2025, reduzida ao suficiente para exercitar as regras: dois
 * critérios pontuados e um de desempate.
 */
function rule(overrides: Partial<ScoringRule> = {}): ScoringRule {
  return {
    processCode: 'DEMO-2026',
    version: 1,
    status: 'DEMONSTRACAO',
    sourceYear: 2025,
    confirmationPolicy: 'DECLARADA',
    criteria: [
      { code: 28, text: 'CadÚnico', order: 1, points: 51, isTiebreak: false },
      { code: 31, text: 'Educação especial', order: 2, points: 25, isTiebreak: false },
      { code: 29, text: 'Irmão matriculado', order: 3, points: 0, isTiebreak: true },
    ],
    ...overrides,
  };
}

const sim = (code: number, confirmed = false): CriterionAnswer => ({
  code,
  answer: true,
  confirmed,
});
const nao = (code: number): CriterionAnswer => ({ code, answer: false, confirmed: false });

describe('score', () => {
  it('soma apenas os critérios respondidos afirmativamente', () => {
    const resultado = score(rule(), [sim(28), nao(31)]);
    expect(resultado.total).toBe(51);
    expect(resultado.maxTotal).toBe(76);
  });

  it('não pontua nada quando tudo é negativo', () => {
    expect(score(rule(), [nao(28), nao(31)]).total).toBe(0);
  });

  it('soma o máximo quando tudo é afirmativo', () => {
    expect(score(rule(), [sim(28), sim(31)]).total).toBe(76);
  });

  /** Resultado parcial precisa ser exibível: a família ainda está respondendo. */
  it('trata critério sem resposta como não pontuado, e não como erro', () => {
    const resultado = score(rule(), [sim(28)]);
    expect(resultado.total).toBe(51);
    const linha = resultado.lines.find((l) => l.code === 31);
    expect(linha?.outcome).toBe('NAO_RESPONDIDA');
    expect(linha?.answer).toBeNull();
  });

  it('ignora resposta a critério que não existe na régua', () => {
    const resultado = score(rule(), [sim(28), sim(999)]);
    expect(resultado.total).toBe(51);
    expect(resultado.lines.map((l) => l.code)).toEqual([28, 31]);
  });

  it('explica cada linha com código estável, sem texto pronto', () => {
    const resultado = score(rule(), [sim(28), nao(31)]);
    expect(resultado.lines.map((l) => l.outcome)).toEqual(['PONTUOU', 'RESPOSTA_NEGATIVA']);
    expect(resultado.lines[0]).toMatchObject({ weight: 51, awarded: 51 });
    expect(resultado.lines[1]).toMatchObject({ weight: 25, awarded: 0 });
  });

  it('devolve as linhas na ordem da régua', () => {
    const invertida = rule({
      criteria: [
        { code: 31, text: 'B', order: 2, points: 25, isTiebreak: false },
        { code: 28, text: 'A', order: 1, points: 51, isTiebreak: false },
      ],
    });
    expect(score(invertida, []).lines.map((l) => l.order)).toEqual([1, 2]);
  });

  it('carrega a versão da regra no resultado (PRD 8.7)', () => {
    const resultado = score(rule(), []);
    expect(resultado.rule).toEqual({
      processCode: 'DEMO-2026',
      version: 1,
      status: 'DEMONSTRACAO',
      sourceYear: 2025,
      confirmationPolicy: 'DECLARADA',
    });
  });

  it('é determinístico: mesma entrada e mesma régua, mesmo resultado', () => {
    const entradas = [sim(28), nao(31)];
    expect(score(rule(), entradas)).toEqual(score(rule(), entradas));
  });

  /**
   * A régua mudou entre 2023 e 2024: o total saiu de 465 para 100 pontos. Uma
   * versão nova não pode alterar o que uma versão antiga calculava (PRD 8.7).
   */
  it('reproduz réguas diferentes sem interferência entre elas', () => {
    const antiga = rule({
      version: 1,
      sourceYear: 2023,
      criteria: [{ code: 2, text: 'Deficiência', order: 1, points: 100, isTiebreak: false }],
    });
    const nova = rule({
      version: 2,
      sourceYear: 2024,
      criteria: [{ code: 2, text: 'Deficiência', order: 1, points: 25, isTiebreak: false }],
    });

    expect(score(antiga, [sim(2)]).total).toBe(100);
    expect(score(nova, [sim(2)]).total).toBe(25);
  });

  describe('política de confirmação (ADR-0038)', () => {
    it('DECLARADA pontua a resposta da família, confirmada ou não', () => {
      const declarada = rule({ confirmationPolicy: 'DECLARADA' });
      expect(score(declarada, [sim(28, false)]).total).toBe(51);
      expect(score(declarada, [sim(28, true)]).total).toBe(51);
    });

    it('CONFIRMADA exige a validação para somar', () => {
      const confirmada = rule({ confirmationPolicy: 'CONFIRMADA' });
      expect(score(confirmada, [sim(28, false)]).total).toBe(0);
      expect(score(confirmada, [sim(28, true)]).total).toBe(51);
    });

    it('distingue aguardando confirmação de resposta negativa', () => {
      const confirmada = rule({ confirmationPolicy: 'CONFIRMADA' });
      const resultado = score(confirmada, [sim(28, false), nao(31)]);
      expect(resultado.lines.map((l) => l.outcome)).toEqual([
        'AGUARDA_CONFIRMACAO',
        'RESPOSTA_NEGATIVA',
      ]);
    });

    it('a política escolhida viaja no resultado', () => {
      for (const policy of ['DECLARADA', 'CONFIRMADA'] as ConfirmationPolicy[]) {
        expect(score(rule({ confirmationPolicy: policy }), []).rule.confirmationPolicy).toBe(
          policy,
        );
      }
    });
  });

  describe('critérios de desempate', () => {
    it('não somam pontos', () => {
      expect(score(rule(), [sim(29)]).total).toBe(0);
    });

    it('saem separados das linhas de pontuação', () => {
      const resultado = score(rule(), [sim(29)]);
      expect(resultado.lines.map((l) => l.code)).not.toContain(29);
      expect(resultado.tiebreaks.map((t) => t.code)).toEqual([29]);
      expect(resultado.tiebreaks[0]?.applies).toBe(true);
    });

    it('respeitam a política de confirmação', () => {
      const confirmada = rule({ confirmationPolicy: 'CONFIRMADA' });
      expect(score(confirmada, [sim(29, false)]).tiebreaks[0]?.applies).toBe(false);
      expect(score(confirmada, [sim(29, true)]).tiebreaks[0]?.applies).toBe(true);
    });

    it('não se aplicam quando não respondidos', () => {
      expect(score(rule(), []).tiebreaks[0]?.applies).toBe(false);
    });
  });
});

describe('maxTotalFor', () => {
  it('soma os pesos da régua, ignorando desempates que valem zero', () => {
    expect(maxTotalFor(rule())).toBe(76);
  });
});

describe('compareForRanking', () => {
  const maior = score(rule(), [sim(28), sim(31)]);
  const menor = score(rule(), [sim(28)]);

  it('ordena do maior total para o menor', () => {
    expect(compareForRanking(maior, menor)).toBeLessThan(0);
    expect(compareForRanking(menor, maior)).toBeGreaterThan(0);
  });

  it('desempata pelo critério de desempate, na ordem da régua', () => {
    const comIrmao = score(rule(), [sim(28), sim(29)]);
    const semIrmao = score(rule(), [sim(28)]);
    expect(compareForRanking(comIrmao, semIrmao)).toBeLessThan(0);
    expect(compareForRanking(semIrmao, comIrmao)).toBeGreaterThan(0);
  });

  /** A decisão final é da Fase 8; aqui só se declara que não houve separação. */
  it('devolve zero quando nem os desempates separam', () => {
    const a = score(rule(), [sim(28)]);
    const b = score(rule(), [sim(28)]);
    expect(compareForRanking(a, b)).toBe(0);
  });

  it('ordena uma lista de forma estável e reprodutível', () => {
    const lista = [menor, maior, score(rule(), [])];
    const ordenada = [...lista].sort(compareForRanking).map((r) => r.total);
    expect(ordenada).toEqual([76, 51, 0]);
  });

  it('tolera resultados com quantidades diferentes de desempate', () => {
    const semDesempate = score(rule({ criteria: rule().criteria.slice(0, 2) }), [sim(28)]);
    expect(compareForRanking(semDesempate, menor)).toBe(0);
  });
});
