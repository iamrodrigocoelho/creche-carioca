import { DemoBadge } from '@match/ui';
import type { ApplicationResponse } from '@match/schemas';

/**
 * Resultado do grupamento etario com explicacao estruturada.
 *
 * PRD 8.7: a explicacao vem PRONTA do backend, montada a partir de dados
 * estruturados. A interface apenas renderiza - nao recalcula nem reinterpreta.
 *
 * PRD 1.2 / 17: o selo de demonstracao e o texto de status acompanham o resultado,
 * e nenhum status depende apenas de cor.
 */

const OUTCOME_HEADLINE: Readonly<Record<ApplicationResponse['ageGroup']['outcome'], string>> = {
  MATCHED: 'Grupamento encontrado',
  BELOW_MINIMUM_AGE: 'Ainda não é a hora',
  ABOVE_MAXIMUM_AGE: 'Fora da faixa de creche',
};

export function AgeGroupResult({ application }: { application: ApplicationResponse }) {
  const { ageGroup } = application;

  return (
    <section className="mp-card mp-stack-md" aria-labelledby="resultado-titulo">
      <div className="mp-actions">
        <DemoBadge>Resultado de demonstração</DemoBadge>
      </div>

      <h2 className="mp-display-md" id="resultado-titulo">
        {OUTCOME_HEADLINE[ageGroup.outcome]}
      </h2>

      {ageGroup.outcome === 'MATCHED' && ageGroup.label ? (
        <p className="mp-lead">
          A criança concorre no grupamento <strong>{ageGroup.label}</strong>.
        </p>
      ) : (
        <p className="mp-lead">
          Com essa data de nascimento, a criança não se enquadra em nenhum grupamento de creche na
          data de referência desta regra.
        </p>
      )}

      <div className="mp-stack-xs">
        <h3 className="mp-body-strong">Como chegamos nesse resultado</h3>
        <ol className="mp-explanation">
          {ageGroup.explanation.map((step, index) => (
            <li className="mp-explanation__item" key={step.code}>
              <span className="mp-explanation__index" aria-hidden="true">
                {index + 1}.
              </span>
              <span className="mp-caption">{step.summary}</span>
            </li>
          ))}
        </ol>
      </div>

      <dl className="mp-stack-xs">
        <div>
          <dt className="mp-caption-strong">Protocolo desta inscrição</dt>
          {/* PRD 8.14: identificador de protocolo, nunca o nome da crianca. */}
          <dd className="mp-caption mp-muted">{application.id}</dd>
        </div>
        <div>
          <dt className="mp-caption-strong">Versão da regra aplicada</dt>
          <dd className="mp-caption mp-muted">
            {ageGroup.policy.id} · versão {ageGroup.policy.version} · {ageGroup.policy.status}
          </dd>
        </div>
      </dl>

      <p className="mp-micro-legal">
        As faixas de idade desta versão são dados de demonstração e ainda dependem de confirmação
        oficial da Secretaria Municipal de Educação. Este protótipo não substitui o sistema oficial
        de matrícula.
      </p>
    </section>
  );
}
