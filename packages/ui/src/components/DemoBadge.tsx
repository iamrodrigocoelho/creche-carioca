/**
 * Selo de dado de demonstracao.
 *
 * PRD 1.2: "Nao apresentar indicadores dos dados anonimizados como retrato
 * oficial da realidade do municipio." Toda superficie que exibe resultado
 * calculado a partir de regra ou dado sintetico deve mostrar este selo.
 *
 * PRD 17: o status nao pode depender apenas de cor - o selo carrega texto.
 */
export interface DemoBadgeProps {
  readonly children?: string;
  readonly onDark?: boolean;
}

export function DemoBadge({ children = 'Dados de demonstração', onDark }: DemoBadgeProps) {
  return (
    <span
      className={['mp-demo-badge', onDark ? 'mp-demo-badge--on-dark' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true">●</span>
      {children}
    </span>
  );
}
