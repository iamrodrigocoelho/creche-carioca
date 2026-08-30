import { PRESSURE_LABELS, formatRatio, type PressureLevel } from '@/lib/dashboard/metrics';

/**
 * Barra de pressao candidato/vaga.
 *
 * PRD 17: nenhuma informacao pode depender so de cor. O numero vem escrito ao
 * lado, o nivel e dito por extenso no rotulo acessivel e a barra e reforco
 * visual. A escala satura em 4 candidatos por vaga — acima disso a diferenca
 * entre 4 e 6 nao muda a decisao do gestor, e uma barra que nunca enche esconde
 * a diferenca entre 1 e 2, que muda.
 */

const SCALE_MAX = 4;

interface Props {
  readonly ratio: number;
  readonly level: PressureLevel;
}

export function PressureMeter({ ratio, level }: Props) {
  const width = Math.min(100, Math.round((ratio / SCALE_MAX) * 100));

  return (
    <span className="mp-meter">
      <span className="mp-meter__track">
        <span
          className={`mp-meter__fill mp-meter__fill--${level}`}
          style={{ width: `${width}%` }}
          aria-hidden="true"
        />
      </span>
      <span className="mp-meter__label">
        {formatRatio(ratio)} por vaga · {PRESSURE_LABELS[level]}
      </span>
    </span>
  );
}
