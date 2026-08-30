import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * {component.button-primary}, {component.button-secondary-pill},
 * {component.button-store-hero}, {component.button-dark-utility} do DESIGN.md.
 *
 * Estados: default, :focus-visible e :active (`scale(0.95)`). O DESIGN.md
 * instrui explicitamente a nao documentar hover.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'store-hero' | 'dark-utility' | 'pearl';

const VARIANT_CLASS: Readonly<Record<ButtonVariant, string>> = {
  primary: 'mp-button--primary',
  secondary: 'mp-button--secondary',
  'store-hero': 'mp-button--store-hero',
  'dark-utility': 'mp-button--dark-utility',
  pearl: 'mp-button--pearl',
};

function classNames(
  variant: ButtonVariant,
  onDark: boolean | undefined,
  className: string | undefined,
): string {
  return ['mp-button', VARIANT_CLASS[variant], onDark ? 'mp-button--on-dark' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Usa a variante contornada exigida pelo DESIGN.md sobre {colors.surface-tile-1}. */
  onDark?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  onDark,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={classNames(variant, onDark, className)} {...rest}>
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: ButtonVariant;
  onDark?: boolean;
  children: ReactNode;
}

export function ButtonLink({
  variant = 'primary',
  onDark,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={classNames(variant, onDark, className)} {...rest}>
      {children}
    </a>
  );
}
