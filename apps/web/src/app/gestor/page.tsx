import type { Metadata } from 'next';

import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { getDemoSnapshot } from '@/lib/dashboard/demo-data';

/**
 * Painel do gestor (RF-10).
 *
 * O snapshot e resolvido no servidor. Hoje ele vem de um conjunto sintetico; na
 * Fase 6 vira uma consulta ao banco, sem mudanca nesta pagina.
 */

export const metadata: Metadata = {
  title: 'Painel do gestor | Match Perfeito',
  description:
    'Demonstração do painel operacional: inscrições, unidades mais procuradas e fila de espera por território.',
  robots: { index: false, follow: false },
};

export default function GestorPage() {
  return <ManagerDashboard snapshot={getDemoSnapshot()} />;
}
