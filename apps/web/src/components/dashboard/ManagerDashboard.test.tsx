import { cleanup, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { getDemoSnapshot } from '@/lib/dashboard/demo-data';
import { formatInteger, formatRatio, rankUnitsByDemand, totalize } from '@/lib/dashboard/metrics';
import type { DemoProcessSnapshot } from '@/lib/dashboard/types';

import { ManagerDashboard } from './ManagerDashboard';

const snapshot = getDemoSnapshot();

function renderDashboard(over: Partial<DemoProcessSnapshot> = {}) {
  return render(<ManagerDashboard snapshot={{ ...snapshot, ...over }} />);
}

afterEach(() => {
  cleanup();
});

describe('ManagerDashboard', () => {
  it('declara em voz alta que o dado nao e oficial (PRD 1.2)', () => {
    renderDashboard();

    expect(screen.getByText(/não é a fila oficial da SME/i)).toBeDefined();
    expect(screen.getByText(/conjunto sintético/i)).toBeDefined();
  });

  it('mostra as tres perguntas do gestor como secoes navegaveis', () => {
    renderDashboard();

    expect(screen.getByRole('heading', { level: 1, name: /painel do gestor/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /creches mais procuradas/i })).toBeDefined();
    expect(screen.getByRole('heading', { name: /fila de espera por território/i })).toBeDefined();
    expect(
      screen.getByRole('heading', { name: /comparação com os processos anteriores/i }),
    ).toBeDefined();
  });

  it('mostra o total de inscricoes e a razao candidato/vaga da rede', () => {
    const { container } = renderDashboard();

    const totals = totalize(snapshot.demand);
    const applications =
      snapshot.status.submetida + snapshot.status.rascunho + snapshot.status.cancelada;
    const values = [...container.querySelectorAll('.mp-metric__value')].map(
      (node) => node.textContent,
    );

    expect(values).toContain(formatInteger(applications));
    expect(values).toContain(formatInteger(totals.seats));
    expect(values).toContain(formatRatio(totals.ratio));
  });

  it('lista as unidades mais procuradas em ordem decrescente de 1a opcao', () => {
    renderDashboard();

    const ranked = rankUnitsByDemand(snapshot.demand, snapshot.units, snapshot.cres);
    const table = screen.getByRole('table', { name: /demanda e fila por unidade/i });
    const rows = within(table).getAllByRole('row').slice(1);

    expect(within(rows[0] as HTMLElement).getByText(ranked[0]!.unit.name)).toBeDefined();
    // O topo e um recorte: a tabela nao despeja as 44 unidades de uma vez.
    expect(rows.length).toBeLessThan(snapshot.units.length);
  });

  it('expande e recolhe a lista completa de unidades', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /ver todas as .* unidades/i }));

    const table = screen.getByRole('table', { name: /demanda e fila por unidade/i });
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(snapshot.units.length);

    await user.click(screen.getByRole('button', { name: /mostrar apenas as/i }));
    expect(
      within(screen.getByRole('table', { name: /demanda e fila por unidade/i })).getAllByRole('row')
        .length,
    ).toBeLessThan(snapshot.units.length + 1);
  });

  it('recorta por territorio e anuncia o novo escopo', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.selectOptions(screen.getByLabelText('Território'), 'CRE-09');

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('9ª CRE');

    const regions = screen.getByRole('table', { name: /fila por coordenadoria/i });
    expect(within(regions).getAllByRole('row').slice(1)).toHaveLength(1);
  });

  it('recorta por grupamento sem perder o recorte de territorio', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.selectOptions(screen.getByLabelText('Território'), 'CRE-09');
    await user.selectOptions(screen.getByLabelText('Grupamento'), 'BERCARIO_I');

    const ageGroups = screen.getByRole('table', { name: /fila por grupamento/i });
    const rows = within(ageGroups).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(1);
    expect(within(rows[0] as HTMLElement).getByText('Berçário I')).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('9ª CRE');
  });

  it('limpa o recorte e volta a rede inteira', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.selectOptions(screen.getByLabelText('Turno'), 'PARCIAL');
    await user.click(screen.getByRole('button', { name: /limpar recorte/i }));

    expect(screen.getByRole('status').textContent).toContain('toda a rede');
    expect(screen.queryByRole('button', { name: /limpar recorte/i })).toBeNull();
  });

  it('compara com o processo anterior no mesmo dia da janela, nunca com o total fechado', () => {
    renderDashboard();

    const table = screen.getByRole('table', { name: /equivalente textual do gráfico/i });
    expect(within(table).getByText('DEMO-2026')).toBeDefined();
    expect(within(table).getByText(/em andamento/i)).toBeDefined();
    // O processo em andamento nao tem total de fim de janela: fica em branco.
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('mantem o grafico fora da arvore de acessibilidade e oferece a tabela equivalente', () => {
    const { container } = renderDashboard();

    const trend = container.querySelector('.mp-trend');
    expect(trend?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('table', { name: /equivalente textual do gráfico/i })).toBeDefined();
  });

  it('suprime celula pequena em vez de expor uma crianca (PRD 13.2)', () => {
    // Uma unica linha, com demanda abaixo do limiar: a supressao age sobre a
    // celula agregada, nao sobre a linha crua.
    const tiny = snapshot.demand.slice(0, 1).map((row) => ({
      ...row,
      firstChoice: 2,
      otherChoices: 1,
    }));
    renderDashboard({ demand: tiny });

    const table = screen.getByRole('table', { name: /demanda e fila por unidade/i });
    expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
  });

  it('explica um recorte vazio em vez de mostrar uma tabela em branco', async () => {
    const user = userEvent.setup();
    // Um territorio sem nenhuma unidade no conjunto: o painel precisa dizer isso.
    renderDashboard({ units: snapshot.units.filter((unit) => unit.creId !== 'CRE-02') });

    await user.selectOptions(screen.getByLabelText('Território'), 'CRE-02');

    expect(screen.getByText(/nenhuma unidade corresponde a este recorte/i)).toBeDefined();
  });
});
