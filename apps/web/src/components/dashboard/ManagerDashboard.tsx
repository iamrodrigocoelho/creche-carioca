'use client';

import { useMemo, useState } from 'react';

import { AGE_GROUP_CODES, DEMO_AGE_GROUP_POLICY_2026, type AgeGroupCode } from '@match/domain';
import { Button, DemoBadge, SelectField } from '@match/ui';

import { OFFER_SHIFTS } from '@/lib/dashboard/demo-data';
import {
  SMALL_CELL_THRESHOLD,
  aggregateByAgeGroup,
  aggregateByRegion,
  compareWithHistory,
  filterDemand,
  formatDelta,
  formatInteger,
  formatRatio,
  pressureLevel,
  rankUnitsByDemand,
  totalize,
} from '@/lib/dashboard/metrics';
import type { DemoProcessSnapshot, OfferShift } from '@/lib/dashboard/types';

import { AgeGroupQueueTable } from './AgeGroupQueueTable';
import { HistoryTrend } from './HistoryTrend';
import { MetricCard } from './MetricCard';
import { RegionQueueTable } from './RegionQueueTable';
import { UnitDemandTable } from './UnitDemandTable';

/**
 * Painel do gestor (RF-10, PRD 8.10).
 *
 * Tres perguntas, nesta ordem: quantas inscricoes existem, onde a procura se
 * concentra e onde a fila dói. Os filtros de territorio, grupamento e turno
 * atravessam as tres — mudar o recorte sem recarregar a pagina e o que
 * transforma uma tabela numa investigacao.
 *
 * O conjunto de dados e sintetico e declarado como tal em toda superficie
 * (PRD 1.2). Quando a Fase 6 trouxer `Unit` e `Preference` para o banco, este
 * componente continua igual: muda so a origem do `snapshot`.
 */

const AGE_GROUP_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  DEMO_AGE_GROUP_POLICY_2026.bands.map((band) => [band.code, band.label]),
);

const SHIFT_LABELS: Readonly<Record<OfferShift, string>> = {
  INTEGRAL: 'Integral',
  PARCIAL: 'Parcial',
};

const TOP_UNITS = 12;

const ALL = '';

interface Props {
  readonly snapshot: DemoProcessSnapshot;
}

export function ManagerDashboard({ snapshot }: Props) {
  const [creId, setCreId] = useState<string>(ALL);
  const [ageGroup, setAgeGroup] = useState<string>(ALL);
  const [shift, setShift] = useState<string>(ALL);
  const [showAllUnits, setShowAllUnits] = useState(false);

  const hasFilter = creId !== ALL || ageGroup !== ALL || shift !== ALL;

  const view = useMemo(() => {
    const rows = filterDemand(snapshot.demand, snapshot.units, {
      ...(creId ? { creId } : {}),
      ...(ageGroup ? { ageGroup: ageGroup as AgeGroupCode } : {}),
      ...(shift ? { shift: shift as OfferShift } : {}),
    });

    return {
      totals: totalize(rows),
      units: rankUnitsByDemand(rows, snapshot.units, snapshot.cres),
      regions: aggregateByRegion(rows, snapshot.units, snapshot.cres),
      ageGroups: aggregateByAgeGroup(rows, AGE_GROUP_CODES),
    };
  }, [snapshot, creId, ageGroup, shift]);

  const history = useMemo(() => compareWithHistory(snapshot.history), [snapshot.history]);
  // Os numeros de topo descrevem a rede inteira, nao o recorte: mudar o filtro
  // nao pode mudar o tamanho do processo.
  const network = useMemo(() => totalize(snapshot.demand), [snapshot.demand]);

  const totalApplications =
    snapshot.status.submetida + snapshot.status.rascunho + snapshot.status.cancelada;
  const visibleUnits = showAllUnits ? view.units : view.units.slice(0, TOP_UNITS);
  const scopeLabel = creId
    ? (snapshot.cres.find((cre) => cre.id === creId)?.label ?? 'território selecionado')
    : 'toda a rede';

  return (
    <>
      <section className="mp-tile mp-tile--light" aria-labelledby="painel-titulo">
        <div className="mp-tile__inner mp-tile__inner--wide mp-stack-lg">
          <DemoBadge>Dados sintéticos — não é a fila oficial da SME</DemoBadge>
          <h1 className="mp-display-lg" id="painel-titulo">
            Painel do gestor
          </h1>
          <p className="mp-lead">
            {snapshot.processLabel} · dia {snapshot.windowDay} de {snapshot.windowDays} da janela de
            inscrição.
          </p>

          <div className="mp-metric-grid">
            <MetricCard
              label="Inscrições no processo"
              value={formatInteger(totalApplications)}
              note={`${formatInteger(snapshot.status.submetida)} submetidas · ${formatInteger(
                snapshot.status.rascunho,
              )} em rascunho · ${formatInteger(snapshot.status.cancelada)} canceladas`}
            />
            <MetricCard
              label="Vagas ofertadas"
              value={formatInteger(network.seats)}
              note={`${formatInteger(snapshot.units.length)} unidades no recorte de demonstração`}
            />
            <MetricCard
              label="Candidatos por vaga"
              value={formatRatio(network.ratio)}
              note={`Medido pela 1ª opção. Pressão ${pressureLevel(network.ratio)} na rede.`}
            />
            <MetricCard
              label={`Comparação com ${history.previous?.year ?? 'o processo anterior'}`}
              value={formatDelta(history.applicationsDeltaPct)}
              note={`Inscrições até o mesmo dia da janela. Vagas: ${formatDelta(
                history.seatsDeltaPct,
              )}.`}
            />
          </div>
        </div>
      </section>

      <section className="mp-tile mp-tile--parchment" aria-labelledby="recorte">
        <div className="mp-tile__inner mp-tile__inner--wide mp-stack-lg">
          <h2 className="mp-display-md" id="recorte">
            Recorte
          </h2>

          <div className="mp-filter-bar">
            <SelectField
              id="filtro-cre"
              label="Território"
              value={creId}
              onChange={(event) => setCreId(event.target.value)}
            >
              <option value={ALL}>Todas as CREs</option>
              {snapshot.cres.map((cre) => (
                <option key={cre.id} value={cre.id}>
                  {cre.label}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="filtro-grupamento"
              label="Grupamento"
              value={ageGroup}
              onChange={(event) => setAgeGroup(event.target.value)}
            >
              <option value={ALL}>Todos os grupamentos</option>
              {AGE_GROUP_CODES.map((code) => (
                <option key={code} value={code}>
                  {AGE_GROUP_LABELS[code] ?? code}
                </option>
              ))}
            </SelectField>

            <SelectField
              id="filtro-turno"
              label="Turno"
              value={shift}
              onChange={(event) => setShift(event.target.value)}
            >
              <option value={ALL}>Todos os turnos</option>
              {OFFER_SHIFTS.map((code) => (
                <option key={code} value={code}>
                  {SHIFT_LABELS[code]}
                </option>
              ))}
            </SelectField>

            {hasFilter ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCreId(ALL);
                  setAgeGroup(ALL);
                  setShift(ALL);
                }}
              >
                Limpar recorte
              </Button>
            ) : null}
          </div>

          {/* A regiao viva anuncia o novo recorte a quem nao ve a tabela mudar. */}
          <p className="mp-caption" role="status">
            {formatInteger(view.totals.firstChoice)} inscrições em 1ª opção,{' '}
            {formatInteger(view.totals.seats)} vagas e {formatInteger(view.totals.waiting)} na fila
            em {scopeLabel}.
          </p>
        </div>
      </section>

      <section className="mp-tile mp-tile--light" aria-labelledby="mais-procuradas">
        <div className="mp-tile__inner mp-tile__inner--wide mp-stack-lg">
          <div className="mp-panel__head">
            <h2 className="mp-display-md" id="mais-procuradas">
              Creches mais procuradas
            </h2>
            {view.units.length > TOP_UNITS ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAllUnits((current) => !current)}
              >
                {showAllUnits
                  ? `Mostrar apenas as ${TOP_UNITS} primeiras`
                  : `Ver todas as ${formatInteger(view.units.length)} unidades`}
              </Button>
            ) : null}
          </div>
          <p className="mp-caption mp-muted">
            Ordenadas pela 1ª opção das famílias. A coluna de vagas anda junto de propósito: procura
            alta em unidade grande é outro problema que procura alta em unidade pequena.
          </p>

          <UnitDemandTable
            rows={visibleUnits}
            caption={`Demanda e fila por unidade em ${scopeLabel}.`}
          />
        </div>
      </section>

      <section className="mp-tile mp-tile--parchment" aria-labelledby="fila-territorio">
        <div className="mp-tile__inner mp-tile__inner--wide mp-stack-lg">
          <h2 className="mp-display-md" id="fila-territorio">
            Fila de espera por território
          </h2>
          <p className="mp-caption mp-muted">
            A fila por unidade diz para onde mandar vaga. A fila por território diz onde falta
            creche.
          </p>

          <RegionQueueTable
            rows={view.regions}
            caption="Fila por Coordenadoria Regional de Educação, da maior para a menor."
          />

          <h3 className="mp-tagline">Fila por grupamento etário</h3>
          <AgeGroupQueueTable
            rows={view.ageGroups}
            labels={AGE_GROUP_LABELS}
            caption={`Fila por grupamento em ${scopeLabel}.`}
          />
        </div>
      </section>

      <section className="mp-tile mp-tile--light" aria-labelledby="historico">
        <div className="mp-tile__inner mp-tile__inner--wide mp-stack-lg">
          <h2 className="mp-display-md" id="historico">
            Comparação com os processos anteriores
          </h2>
          <p className="mp-caption mp-muted">
            Todos os pontos são medidos no mesmo dia da janela de inscrição. Comparar o parcial de
            hoje com o total fechado do ano passado sugeriria queda de demanda onde não há. Esta
            seção não responde aos filtros do recorte: a série é sempre do processo inteiro.
          </p>

          <HistoryTrend
            comparison={history}
            windowDay={snapshot.windowDay}
            windowDays={snapshot.windowDays}
          />
        </div>
      </section>

      <section className="mp-tile mp-tile--parchment" aria-labelledby="metodo">
        <div className="mp-tile__inner mp-tile__inner--wide mp-stack-md">
          <h2 className="mp-display-md" id="metodo">
            De onde vem cada número
          </h2>
          <div className="mp-note">
            <p className="mp-caption-strong">
              Este painel roda sobre um conjunto sintético. Nenhum número aqui descreve a rede real.
            </p>
            <ul className="mp-note__list">
              <li>
                Os nomes de unidade são fictícios, na convenção da rede (EDI, CM, CP). Os bairros
                são reais apenas para dar escala geográfica; o vínculo com a CRE é ilustrativo.
              </li>
              <li>
                <strong>Candidatos por vaga</strong> é medido pela 1ª opção. Usar a demanda em
                qualquer opção inflaria o indicador, porque a mesma inscrição cita até cinco
                unidades.
              </li>
              <li>
                <strong>Fila</strong> é o excedente da 1ª opção sobre as vagas do recorte. Não é a
                fila oficial: a alocação real considera pontuação, desempate e as demais
                preferências (Fase 8).
              </li>
              <li>
                Células com menos de {SMALL_CELL_THRESHOLD} inscrições aparecem como “—”. Um número
                pequeno num recorte estreito reidentifica uma criança (PRD §13.2).
              </li>
              <li>
                Ainda não há atualização em tempo real nem recorte de acesso por CRE: o painel lê um
                instante fixo ({snapshot.generatedAt}) e mostra a rede inteira a qualquer perfil.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
