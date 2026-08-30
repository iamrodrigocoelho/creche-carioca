import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { Footer, GlobalNav } from '@match/ui';

import './globals.css';

export const metadata: Metadata = {
  title: 'Match Perfeito | Inscrição de creche',
  description:
    'Protótipo de demonstração para a inscrição em creches e Espaços de Desenvolvimento Infantil do Município do Rio de Janeiro.',
  // PRD 13.5: nenhuma referencia publica sequencial deve chegar a indexadores.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#13335a',
};

const NAV_ITEMS = [
  { href: '/inscricao', label: 'Iniciar inscrição' },
  { href: '/sobre', label: 'Sobre a demonstração' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="mp-page">
          {/* PRD 17: navegacao integral por teclado, com atalho para o conteudo. */}
          <a className="mp-skip-link" href="#conteudo">
            Pular para o conteúdo principal
          </a>
          <GlobalNav items={NAV_ITEMS} />
          <main className="mp-page__main" id="conteudo" tabIndex={-1}>
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
