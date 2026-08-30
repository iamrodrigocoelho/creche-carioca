'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { DemoBadge } from '@match/ui';
import type {
  ApiError,
  CriterionListResponse,
  CriterionResponseItem,
  ScoreResultResponse,
} from '@match/schemas';

import { listCriteria, replaceCriterionResponses } from '@/lib/api-client';

/**
 * Etapa 5 da jornada (RF-07, PRD 8.7).
 *
 * A pontuacao e mostrada enquanto a familia responde, com o detalhamento
 * inteiro: cada criterio, quanto vale, quanto somou e por que. PRD 8.7 exige que
 * a explicacao venha dos dados estruturados — o que se faz aqui e escolher as
 * palavras para codigos e numeros que a API ja decidiu, sem recalcular nada.
 *
 * As perguntas tratam de deficiencia, violencia, situacao prisional e uso de
 * substancias. Nao ha como suavizar o conteudo sem falsear a regra, mas dá para
 * nao fazer disso um interrogatorio: nada e obrigatorio, o efeito de cada
 * resposta e visivel, e a familia pode mudar depois.
 */

const OUTCOME_LABELS: Readonly<Record<string, string>> = {
  PONTUOU: 'somou os pontos',
  RESPOSTA_NEGATIVA: 'não se aplica',
  NAO_RESPONDIDA: 'ainda sem resposta',
  AGUARDA_CONFIRMACAO: 'aguardando confirmação da rede',
  CRITERIO_DE_DESEMPATE: 'critério de desempate',
};

interface Props {
  readonly applicationId: string;
}

export function ScoringStep({ applicationId }: Props) {
  const [catalog, setCatalog] = useState<CriterionListResponse | null>(null);
  const [result, setResult] = useState<ScoreResultResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError['error'] | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const load = useCallback(async () => {
    const response = await listCriteria(applicationId);
    if (response.ok) setCatalog(response.data);
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function answer(code: number, value: boolean) {
    setBusy(true);
    setError(null);
    const response = await replaceCriterionResponses(applicationId, {
      responses: [{ code, answer: value }],
    });
    setBusy(false);

    if (response.ok) {
      setResult(response.data);
      await load();
      queueMicrotask(() => statusRef.current?.focus());
    } else {
      setError(response.error);
    }
  }

  if (catalog === null) return null;

  const pontuaveis = catalog.criteria.filter((item) => !item.isTiebreak);
  const desempates = catalog.criteria.filter((item) => item.isTiebreak);
  const respondidos = pontuaveis.filter((item) => item.answer !== null).length;

  return (
    <section className="mp-card mp-stack-md" aria-labelledby="scoring-title">
      <h3 id="scoring-title">Critérios de classificação</h3>

      <DemoBadge>{`Régua do processo de ${catalog.rule.sourceYear} · demonstração`}</DemoBadge>

      <p className="mp-caption">
        Estas são as perguntas que definem a pontuação. Nenhuma é obrigatória, e você pode mudar
        qualquer resposta depois. Mostramos quanto cada uma vale e como o total é formado.
      </p>
      <p className="mp-caption mp-muted">
        {`A régua vigente é a do processo de ${catalog.rule.sourceYear}. A regra de 2026 ainda não foi publicada pela Secretaria, então esta pontuação é uma demonstração e não vale como classificação oficial.`}
      </p>

      {result ? (
        <div className="mp-card mp-card--pearl mp-stack-xs" aria-live="polite">
          <p className="mp-body-strong">{`${result.total} de ${result.maxTotal} pontos`}</p>
          <p className="mp-caption mp-muted">
            {`Somando ${result.lines.filter((line) => line.awarded > 0).length} de ${result.lines.length} critérios pontuáveis.`}
          </p>
        </div>
      ) : null}

      <ul className="mp-anchor-list" aria-label="Critérios pontuáveis">
        {pontuaveis.map((item) => (
          <li key={item.code} className="mp-anchor mp-stack-xs">
            <CriterionRow item={item} busy={busy} onAnswer={answer} result={result} />
          </li>
        ))}
      </ul>

      {desempates.length > 0 ? (
        <>
          <h4>Critérios de desempate</h4>
          <p className="mp-caption mp-muted">
            Não somam pontos. São usados apenas para decidir entre inscrições com a mesma pontuação.
          </p>
          <ul className="mp-anchor-list" aria-label="Critérios de desempate">
            {desempates.map((item) => (
              <li key={item.code} className="mp-anchor mp-stack-xs">
                <CriterionRow item={item} busy={busy} onAnswer={answer} result={result} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {error ? (
        <div className="mp-error-summary" role="alert">
          <p className="mp-caption-strong">Não foi possível salvar</p>
          <p className="mp-caption">{error.message}</p>
          <p className="mp-micro-legal">Código de referência: {error.correlationId}</p>
        </div>
      ) : null}

      <p ref={statusRef} className="mp-status" role="status" tabIndex={-1}>
        {catalog.isComplete
          ? 'Você respondeu todos os critérios que pontuam.'
          : `${respondidos} de ${pontuaveis.length} critérios respondidos. Você pode responder depois.`}
      </p>
    </section>
  );
}

interface RowProps {
  readonly item: CriterionResponseItem;
  readonly busy: boolean;
  readonly result: ScoreResultResponse | null;
  readonly onAnswer: (code: number, value: boolean) => void;
}

function CriterionRow({ item, busy, result, onAnswer }: RowProps) {
  const line = result?.lines.find((entry) => entry.code === item.code);
  const tiebreak = result?.tiebreaks.find((entry) => entry.code === item.code);
  const groupId = `criterio-${item.code}`;

  return (
    <>
      <p className="mp-body-strong" id={groupId}>
        {item.text}
      </p>
      <p className="mp-caption mp-muted">
        {item.isTiebreak ? 'Critério de desempate' : `Vale ${item.points} pontos`}
      </p>

      <div className="mp-radio-row" role="group" aria-labelledby={groupId}>
        {[
          { label: 'Sim', value: true },
          { label: 'Não', value: false },
        ].map((option) => (
          <label
            key={option.label}
            className={['mp-chip', item.answer === option.value ? 'mp-chip--selected' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <input
              className="mp-chip__input"
              type="radio"
              name={groupId}
              checked={item.answer === option.value}
              disabled={busy}
              onChange={() => onAnswer(item.code, option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>

      {line ? (
        <p className="mp-caption mp-muted">
          {`${line.awarded} de ${line.weight} pontos — ${OUTCOME_LABELS[line.outcome] ?? line.outcome}.`}
        </p>
      ) : null}
      {tiebreak?.applies ? (
        <p className="mp-caption mp-muted">
          Este critério favorece sua inscrição em caso de empate.
        </p>
      ) : null}
    </>
  );
}
