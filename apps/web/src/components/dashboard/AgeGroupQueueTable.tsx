import { formatInteger, type AgeGroupDemand } from '@/lib/dashboard/metrics';

import { PressureMeter } from './PressureMeter';

/**
 * Fila por grupamento etario.
 *
 * Fila de Bercario I e fila de Maternal II sao problemas distintos: a primeira
 * depende de turma nova e de razao adulto/crianca, a segunda costuma se resolver
 * com remanejamento. Um total unico esconde exatamente a diferenca que decide a
 * acao.
 */

interface Props {
  readonly rows: readonly AgeGroupDemand[];
  readonly labels: Readonly<Record<string, string>>;
  readonly caption: string;
}

export function AgeGroupQueueTable({ rows, labels, caption }: Props) {
  if (rows.length === 0) {
    return (
      <p className="mp-table__empty mp-caption">Nenhum grupamento corresponde a este recorte.</p>
    );
  }

  return (
    <div className="mp-table-wrap">
      <table className="mp-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Grupamento</th>
            <th scope="col" className="mp-table__num">
              1ª opção
            </th>
            <th scope="col" className="mp-table__num">
              Vagas
            </th>
            <th scope="col" className="mp-table__num">
              Fila
            </th>
            <th scope="col">Candidatos por vaga</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.ageGroup}>
              <th scope="row">{labels[row.ageGroup] ?? row.ageGroup}</th>
              <td className="mp-table__num">{formatInteger(row.firstChoice)}</td>
              <td className="mp-table__num">{formatInteger(row.seats)}</td>
              <td className="mp-table__num">{formatInteger(row.waiting)}</td>
              <td>
                <PressureMeter ratio={row.ratio} level={row.level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
