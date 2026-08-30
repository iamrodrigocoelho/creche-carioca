import { formatInteger, type RegionDemand } from '@/lib/dashboard/metrics';

import { PressureMeter } from './PressureMeter';

/**
 * Fila por territorio (CRE).
 *
 * A fila por unidade responde "para onde mando vaga"; a fila por territorio
 * responde "onde falta creche". Sao decisoes diferentes e por isso duas tabelas.
 */

interface Props {
  readonly rows: readonly RegionDemand[];
  readonly caption: string;
}

export function RegionQueueTable({ rows, caption }: Props) {
  if (rows.length === 0) {
    return (
      <p className="mp-table__empty mp-caption">Nenhum território corresponde a este recorte.</p>
    );
  }

  return (
    <div className="mp-table-wrap">
      <table className="mp-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Território</th>
            <th scope="col" className="mp-table__num">
              Unidades
            </th>
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
            <tr key={row.cre.id}>
              <th scope="row">{row.cre.label}</th>
              <td className="mp-table__num">{formatInteger(row.unitCount)}</td>
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
