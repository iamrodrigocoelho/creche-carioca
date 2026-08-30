import type { ReactNode } from 'react';

/** Numero de topo do painel. `note` diz de onde o numero vem ou com o que compara. */
interface Props {
  readonly label: string;
  readonly value: string;
  readonly note?: ReactNode;
}

export function MetricCard({ label, value, note }: Props) {
  return (
    <div className="mp-metric">
      <span className="mp-metric__label">{label}</span>
      <span className="mp-metric__value">{value}</span>
      {note ? <span className="mp-metric__note">{note}</span> : null}
    </div>
  );
}
