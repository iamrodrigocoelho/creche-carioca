import type { Metadata } from 'next';

import { DemoBadge } from '@match/ui';

import { ApplicationForm } from '@/components/ApplicationForm';

export const metadata: Metadata = {
  title: 'Etapa 1 · Dados da criança | Match Perfeito',
};

export default function InscricaoPage() {
  return (
    <section className="mp-tile mp-tile--light">
      <div className="mp-tile__inner mp-stack-lg">
        <DemoBadge>Etapa 1 de 5 · demonstração</DemoBadge>

        <h1 className="mp-display-md">Vamos começar pelos dados da criança</h1>

        <p className="mp-lead">
          Com o mês e o ano de nascimento, calculamos em qual grupamento a criança concorre — e
          mostramos exatamente como esse resultado foi obtido.
        </p>

        <p className="mp-caption mp-muted">
          <strong>Grupamento</strong> é a turma correspondente à idade da criança na data de
          referência do processo seletivo. <strong>Turno</strong> é a parte do dia em que a criança
          fica na unidade.
        </p>

        <ApplicationForm />
      </div>
    </section>
  );
}
