import { formatInteger, formatRatio, type HistoryComparison } from '@/lib/dashboard/metrics';

/**
 * Serie historica no MESMO dia da janela de inscricao.
 *
 * Comparar o parcial de hoje com o total fechado do ano passado e o erro de
 * leitura mais comum num painel destes, e ele sempre sugere queda. Aqui todos os
 * pontos sao do mesmo dia; o total fechado aparece so como texto de apoio.
 *
 * Grafico em CSS puro: PRD 13.5 impoe CSP restritiva, e uma serie de cinco
 * pontos nao justifica dependencia de terceiros. A tabela equivalente vem logo
 * abaixo, para quem le por leitor de tela (PRD 17).
 */

interface Props {
  readonly comparison: HistoryComparison;
  readonly windowDay: number;
  readonly windowDays: number;
}

export function HistoryTrend({ comparison, windowDay, windowDays }: Props) {
  const max = Math.max(...comparison.series.map((point) => point.applicationsAtSameDay), 1);

  return (
    <>
      <div className="mp-trend" aria-hidden="true">
        {comparison.series.map((point) => {
          const isCurrent = point.processCode === comparison.current.processCode;
          return (
            <div
              key={point.processCode}
              className={`mp-trend__item${isCurrent ? ' mp-trend__item--current' : ''}`}
            >
              <span className="mp-trend__value">{formatInteger(point.applicationsAtSameDay)}</span>
              <span className="mp-trend__column">
                <span
                  className="mp-trend__bar"
                  style={{ height: `${Math.round((point.applicationsAtSameDay / max) * 100)}%` }}
                />
              </span>
              <span className="mp-trend__caption">
                {point.year}
                <br />
                {formatRatio(point.ratio)} por vaga
              </span>
            </div>
          );
        })}
      </div>

      <div className="mp-table-wrap">
        <table className="mp-table">
          <caption>
            Inscrições submetidas até o dia {windowDay} de {windowDays} da janela, por processo.
            Equivalente textual do gráfico acima.
          </caption>
          <thead>
            <tr>
              <th scope="col">Processo</th>
              <th scope="col" className="mp-table__num">
                Até o dia {windowDay}
              </th>
              <th scope="col" className="mp-table__num">
                Total ao fim da janela
              </th>
              <th scope="col" className="mp-table__num">
                Vagas
              </th>
              <th scope="col" className="mp-table__num">
                Candidatos por vaga
              </th>
            </tr>
          </thead>
          <tbody>
            {comparison.series.map((point) => (
              <tr key={point.processCode}>
                <th scope="row">
                  {point.processCode}
                  {point.processCode === comparison.current.processCode ? (
                    <span className="mp-table__sub">Em andamento</span>
                  ) : null}
                </th>
                <td className="mp-table__num">{formatInteger(point.applicationsAtSameDay)}</td>
                <td className="mp-table__num">
                  {point.applicationsFinal === undefined
                    ? '—'
                    : formatInteger(point.applicationsFinal)}
                </td>
                <td className="mp-table__num">{formatInteger(point.seats)}</td>
                <td className="mp-table__num">{formatRatio(point.ratio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
