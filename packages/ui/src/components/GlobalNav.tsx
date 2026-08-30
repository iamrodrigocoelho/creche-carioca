import type { ReactNode } from 'react';

import { BRAND_ALT_TEXT, LOGO_HORIZONTAL_BLACK, PRODUCT_NAME } from '../brand';

/**
 * {component.global-nav} do DESIGN.md.
 *
 * Fundo {colors.surface-tile-1} (#13335a), altura minima 56px, conteudo branco.
 * O logotipo e carregado inalterado de `/img/logo`; como nao ha variante
 * negativa para fundo azul, ele fica sobre uma area de protecao clara
 * (ADR-0008). Nao redesenhar nem recolorir.
 */

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

export interface GlobalNavProps {
  readonly items?: readonly NavItem[];
  /** Rota atual, usada para marcar `aria-current="page"`. */
  readonly currentPath?: string;
  readonly trailing?: ReactNode;
}

export function GlobalNav({ items = [], currentPath, trailing }: GlobalNavProps) {
  const logo = LOGO_HORIZONTAL_BLACK;

  return (
    <header className="mp-global-nav">
      <nav className="mp-global-nav__inner" aria-label="Navegação principal">
        <a className="mp-global-nav__brand" href="/">
          <span className="mp-global-nav__logo-plate">
            <img
              className="mp-global-nav__logo"
              src={logo.src}
              width={logo.intrinsicWidth}
              height={logo.intrinsicHeight}
              alt={BRAND_ALT_TEXT}
            />
          </span>
          <span className="mp-global-nav__product">{PRODUCT_NAME}</span>
        </a>

        <div className="mp-global-nav__links">
          {items.map((item) => (
            <a
              key={item.href}
              className="mp-global-nav__link"
              href={item.href}
              {...(currentPath === item.href ? { 'aria-current': 'page' as const } : {})}
            >
              {item.label}
            </a>
          ))}
          {trailing}
        </div>
      </nav>
    </header>
  );
}
