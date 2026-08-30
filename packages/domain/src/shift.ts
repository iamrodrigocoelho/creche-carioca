/**
 * Turno desejado pela familia (PRD 8.1 "turno desejado: integral, parcial ou ambos").
 */
export const SHIFTS = ['INTEGRAL', 'PARCIAL', 'AMBOS'] as const;

export type Shift = (typeof SHIFTS)[number];

const SHIFT_LABELS: Readonly<Record<Shift, string>> = {
  INTEGRAL: 'Integral',
  PARCIAL: 'Parcial',
  AMBOS: 'Integral ou parcial',
};

export function isShift(value: unknown): value is Shift {
  return typeof value === 'string' && (SHIFTS as readonly string[]).includes(value);
}

export function shiftLabel(shift: Shift): string {
  return SHIFT_LABELS[shift];
}
