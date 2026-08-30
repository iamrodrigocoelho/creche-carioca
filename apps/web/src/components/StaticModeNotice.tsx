'use client';

import { useState } from 'react';

import { Button } from '@match/ui';

import { clearLocalData } from '@/lib/static-backend';
import { STATIC_MODE } from '@/lib/config';

/**
 * Aviso do modo estatico (ADR-0027).
 *
 * Sem servidor, o que a familia digita fica no proprio dispositivo. Isso precisa
 * ser dito, e precisa vir acompanhado de como desfazer: PRD 13.2 pede
 * minimizacao, e guardar dado no navegador de alguem sem oferecer como apagar
 * seria o contrario disso.
 *
 * Renderiza `null` fora do modo estatico, entao o componente pode ficar na
 * pagina sem condicionais espalhadas.
 */
export function StaticModeNotice() {
  const [cleared, setCleared] = useState(false);

  if (!STATIC_MODE) return null;

  return (
    <aside className="mp-card mp-card--pearl mp-stack-xs" aria-labelledby="static-notice-title">
      <p id="static-notice-title" className="mp-caption-strong">
        Demonstração sem servidor
      </p>
      <p className="mp-caption">
        Esta versão funciona inteiramente no seu navegador: não há servidor nem banco de dados. O
        que você preencher fica guardado apenas neste dispositivo e não é enviado a lugar nenhum.
      </p>
      <div className="mp-actions">
        <Button
          variant="pearl"
          onClick={() => {
            clearLocalData();
            setCleared(true);
          }}
        >
          Apagar os dados deste dispositivo
        </Button>
      </div>
      <p className="mp-status" role="status">
        {cleared ? 'Dados apagados. Recarregue a página para começar de novo.' : ''}
      </p>
    </aside>
  );
}
