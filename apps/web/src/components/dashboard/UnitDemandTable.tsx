import { formatInteger, suppressSmallCell, type UnitDemand } from '@/lib/dashboard/metrics';

import { PressureMeter } from './PressureMeter';

/**
 * Creches mais procuradas e sua fila.
 *
 * "Mais procurada" sozinha engana: uma unidade com 300 primeiras opcoes e 200
 * vagas esta melhor que uma com 80 e 12. Por isso demanda, vagas, fila e razao
 * andam sempre na mesma linha — a coluna de vagas nao e opcional.
 */

const KIND_LABELS = {
  EDI: 'EDI',
  CRECHE_MUNICIPAL: 'Creche municipal',
  CONVENIADA: 'Conveniada',
} as const;

interface Props {
  readonly rows: readonly UnitDemand[];
  readonly caption: string;
}

/** Celula pequena vira travessao: PRD 13.2, minimizacao. */
function cell(value: number): string {
  const safe = suppressSmallCell(value);
  return safe === null ? '—' : formatInteger(safe);
}

export function UnitDemandTable({ rows, caption }: Props) {
  if (rows.length === 0) {
    return (
      <p className="mp-table__empty mp-caption">
        Nenhuma unidade corresponde a este recorte. Amplie o filtro de território, grupamento ou
        turno.
      </p>
    );
  }

  return (
    <div className="mp-table-wrap">
      <table className="mp-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Unidade</th>
            <th scope="col" className="mp-table__num">
              1ª opção
            </th>
            <th scope="col" className="mp-table__num">
              Qualquer opção
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
            <tr key={row.unit.code}>
              <th scope="row">
                {row.unit.name}
                <span className="mp-table__sub">
                  {KIND_LABELS[row.unit.kind]} · {row.unit.neighborhood} · {row.creLabel}
                </span>
              </th>
              <td className="mp-table__num">{cell(row.firstChoice)}</td>
              <td className="mp-table__num">{cell(row.anyChoice)}</td>
              <td className="mp-table__num">{formatInteger(row.seats)}</td>
              <td className="mp-table__num">{cell(row.waiting)}</td>
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
