'use client';

import { useState, type ReactNode } from 'react';

import { BRAND_ALT_TEXT, LOGO_CRECHE_CARIOCA_HEADER } from '../brand';

/**
 * {component.global-nav} do DESIGN.md.
 *
 * Fundo {colors.surface-tile-1} (#13335a), altura minima 56px, conteudo branco.
 * O logotipo e carregado inalterado de `/img/logo`.
 *
 * DESIGN.md, Collapsing Strategy: "em 834px ou menos, recolhe os links e mantem
 * o logotipo oficial de /img/logo, menu e acoes essenciais". O botao de menu
 * existe apenas nessa faixa; no desktop os links voltam a ser uma linha
 * horizontal e o botao fica oculto. Todos os alvos de toque respeitam os
 * 44 x 44px exigidos em "Touch Targets".
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

const MENU_ID = 'mp-global-nav-menu';

export function GlobalNav({ items = [], currentPath, trailing }: GlobalNavProps) {
  const [open, setOpen] = useState(false);
  const logo = LOGO_CRECHE_CARIOCA_HEADER;

  return (
    <header className="mp-global-nav">
      <nav className="mp-global-nav__inner" aria-label="Navegação principal">
        <a className="mp-global-nav__brand" href="/">
          <img
            className="mp-global-nav__logo"
            src={logo.src}
            width={logo.intrinsicWidth}
            height={logo.intrinsicHeight}
            alt={BRAND_ALT_TEXT}
          />
        </a>

        {items.length > 0 ? (
          <button
            className="mp-global-nav__toggle"
            type="button"
            aria-controls={MENU_ID}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {/* As barras sao decorativas; quem le a tela ouve o rotulo textual. */}
            <span className="mp-global-nav__toggle-bars" aria-hidden="true" />
            Menu
          </button>
        ) : null}

        <div
          className={['mp-global-nav__links', open ? 'mp-global-nav__links--open' : '']
            .filter(Boolean)
            .join(' ')}
          id={MENU_ID}
        >
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
