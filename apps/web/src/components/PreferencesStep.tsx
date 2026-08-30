'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, TextField } from '@match/ui';
import type {
  ApiError,
  PreferenceResponse,
  RecommendationListResponse,
  UnitCard,
} from '@match/schemas';

import { listPreferences, listRecommendations, replacePreferences } from '@/lib/api-client';

/**
 * Etapa 4 da jornada (RF-05, RF-06, PRD 8.5 e 8.6).
 *
 * A lista de unidades vem ordenada por proximidade, mas **nada e filtrado por
 * distancia**: PRD 8.5 proibe que a recomendacao territorial impeca a escolha
 * livre. Os filtros de bairro e nome reduzem a lista porque sao decisao da
 * familia, nao do sistema.
 *
 * A reordenacao existe nas duas formas que PRD 8.6 exige. Os botoes de mover
 * sao o caminho principal — funcionam com teclado, com leitor de tela e no
 * celular; o arrastar e conveniencia para quem usa mouse (ADR-0036).
 */

const MAX_PREFERENCES = 5;

const DEMAND_LABELS: Readonly<Record<UnitCard['demandLevel'], string>> = {
  BAIXA: 'procura baixa',
  MEDIA: 'procura média',
  ALTA: 'procura alta',
  MUITO_ALTA: 'procura muito alta',
};

const REASON_LABELS: Readonly<Record<string, (values: Record<string, string | number>) => string>> =
  {
    PROXIMA_DA_RESIDENCIA: (v) => `A ${v.km} km da sua residência`,
    PROXIMA_DE_OUTRO_PONTO: (v) => `A ${v.km} km do ponto ${v.ponto}`,
    MESMO_BAIRRO: (v) => `No mesmo bairro que você informou (${v.bairro})`,
    ATENDE_O_GRUPAMENTO: () => 'Já atendeu esse grupamento nos anos anteriores',
    ATENDE_O_TURNO: (v) => `Já ofereceu o turno ${String(v.turno).toLowerCase()}`,
    DEMANDA_HISTORICA: (v) =>
      `Historicamente com ${DEMAND_LABELS[v.nivel as UnitCard['demandLevel']]}`,
    SEM_LOCALIZACAO: () => 'Sem localização conhecida — não foi possível calcular a distância',
  };

interface Props {
  readonly applicationId: string;
  readonly ageGroupCode: string;
  readonly shift: string;
  /** Muda quando os pontos de referencia mudam, forcando o recalculo da lista. */
  readonly anchorsVersion?: number;
}

export function PreferencesStep({ applicationId, ageGroupCode, shift, anchorsVersion = 0 }: Props) {
  const [recommendations, setRecommendations] = useState<RecommendationListResponse | null>(null);
  const [chosen, setChosen] = useState<readonly PreferenceResponse[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError['error'] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const load = useCallback(
    async (term: string) => {
      const [recs, prefs] = await Promise.all([
        listRecommendations(applicationId, term ? { search: term } : {}),
        listPreferences(applicationId),
      ]);
      if (recs.ok) setRecommendations(recs.data);
      if (prefs.ok) setChosen(prefs.data.preferences);
    },
    [applicationId],
  );

  useEffect(() => {
    void load('');
    // `anchorsVersion` entra nas dependencias de proposito: informar um CEP muda
    // as distancias de todas as unidades, e a lista precisa ser refeita.
  }, [load, anchorsVersion]);

  async function persist(order: readonly PreferenceResponse[]) {
    setBusy(true);
    setError(null);
    const result = await replacePreferences(applicationId, {
      preferences: order.map((item) => ({
        unitCode: item.unit.code,
        ageGroupCode: item.ageGroupCode,
        shift: item.shift,
      })),
    });
    setBusy(false);
    if (result.ok) {
      setChosen(result.data.preferences);
      queueMicrotask(() => statusRef.current?.focus());
    } else {
      setError(result.error);
    }
  }

  function add(unit: UnitCard) {
    if (chosen.length >= MAX_PREFERENCES) return;
    if (chosen.some((item) => item.unit.code === unit.code)) return;

    void persist([
      ...chosen,
      {
        position: chosen.length + 1,
        unit: {
          id: unit.id,
          code: unit.code,
          name: unit.name,
          type: unit.type,
          neighborhood: unit.neighborhood,
          demandLevel: unit.demandLevel,
        },
        ageGroupCode: ageGroupCode as PreferenceResponse['ageGroupCode'],
        shift: shift as PreferenceResponse['shift'],
        distances: unit.distances,
        isFar: unit.isFar,
      },
    ]);
  }

  function remove(code: string) {
    const restante = chosen.filter((item) => item.unit.code !== code);
    if (restante.length === 0) {
      // PRD 8.6 exige de uma a cinco unidades; esvaziar seria estado inválido.
      setChosen([]);
      return;
    }
    void persist(restante);
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= chosen.length) return;
    const next = [...chosen];
    const [item] = next.splice(from, 1);
    if (item === undefined) return;
    next.splice(to, 0, item);
    void persist(next);
  }

  const escolhidos = new Set(chosen.map((item) => item.unit.code));
  const cheio = chosen.length >= MAX_PREFERENCES;

  return (
    <section className="mp-card mp-stack-md" aria-labelledby="preferences-title">
      <h3 id="preferences-title">Escolha das unidades</h3>
      <p className="mp-caption">
        Escolha de uma a cinco unidades, na ordem da sua preferência. A lista começa pelas mais
        perto dos pontos que você informou, mas você pode escolher qualquer uma.
      </p>

      {chosen.length > 0 ? (
        <>
          <h4 id="chosen-title">Suas preferências, em ordem</h4>
          <ol className="mp-anchor-list" aria-labelledby="chosen-title">
            {chosen.map((item, index) => (
              <li
                key={item.unit.code}
                className="mp-anchor mp-stack-xs"
                draggable
                onDragStart={() => setDragging(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragging !== null && dragging !== index) move(dragging, index);
                  setDragging(null);
                }}
                onDragEnd={() => setDragging(null)}
              >
                <span className="mp-body-strong">{`${index + 1}. ${item.unit.name}`}</span>
                <span className="mp-caption">
                  {[item.unit.type, item.unit.neighborhood].filter(Boolean).join(' · ')}
                </span>
                {item.isFar ? (
                  <span className="mp-caption mp-muted" role="note">
                    Esta unidade fica longe dos pontos que você informou. Você pode mantê-la assim
                    mesmo.
                  </span>
                ) : null}

                <div className="mp-actions">
                  <Button
                    variant="pearl"
                    disabled={busy || index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    {`Mover ${item.unit.name} para cima`}
                  </Button>
                  <Button
                    variant="pearl"
                    disabled={busy || index === chosen.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    {`Mover ${item.unit.name} para baixo`}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => remove(item.unit.code)}
                  >
                    {`Retirar ${item.unit.name}`}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      <form
        className="mp-form"
        onSubmit={(event) => {
          event.preventDefault();
          void load(search);
        }}
        noValidate
      >
        <TextField
          id="unit-search"
          label="Buscar unidade pelo nome"
          hint="Use se você já sabe o nome da creche que procura."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="mp-actions">
          <Button variant="secondary" type="submit" disabled={busy}>
            Buscar
          </Button>
        </div>
      </form>

      {recommendations ? (
        <>
          <p className="mp-caption mp-muted">{recommendations.historicalNotice}</p>
          <ul className="mp-anchor-list" aria-label="Unidades recomendadas">
            {recommendations.units.map((unit) => (
              <li key={unit.code} className="mp-anchor mp-stack-xs">
                <span className="mp-body-strong">{unit.name}</span>
                <span className="mp-caption">
                  {[unit.type, unit.neighborhood].filter(Boolean).join(' · ')}
                </span>

                {unit.distances.length > 0 ? (
                  <span className="mp-caption">
                    {unit.distances
                      .map((d) => `${distanceLabel(d.anchorKind)}: cerca de ${d.distance.km} km`)
                      .join(' · ')}
                  </span>
                ) : null}

                <ul className="mp-caption mp-muted">
                  {unit.reasons.map((reason) => (
                    <li key={reason.code}>
                      {REASON_LABELS[reason.code]?.(reason.values) ?? reason.code}
                    </li>
                  ))}
                </ul>

                <span className="mp-caption mp-muted">
                  {`Grupamentos já atendidos: ${
                    unit.historicalAgeGroups.length > 0
                      ? unit.historicalAgeGroups.join(', ')
                      : 'não informado'
                  }. Turnos: ${
                    unit.historicalShifts.length > 0
                      ? unit.historicalShifts.join(', ')
                      : 'não informado'
                  }.`}
                </span>

                <div className="mp-actions">
                  <Button
                    disabled={busy || cheio || escolhidos.has(unit.code)}
                    onClick={() => add(unit)}
                  >
                    {escolhidos.has(unit.code)
                      ? `${unit.name} já escolhida`
                      : `Escolher ${unit.name}`}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {cheio ? (
        <p className="mp-caption mp-muted">
          Você já escolheu cinco unidades. Retire uma para trocar.
        </p>
      ) : null}

      {error ? (
        <div className="mp-error-summary" role="alert">
          <p className="mp-caption-strong">Não foi possível salvar</p>
          <p className="mp-caption">{error.message}</p>
          <p className="mp-micro-legal">Código de referência: {error.correlationId}</p>
        </div>
      ) : null}

      <p ref={statusRef} className="mp-status" role="status" tabIndex={-1}>
        {chosen.length === 0
          ? 'Escolha ao menos uma unidade para concluir esta etapa.'
          : `${chosen.length} de ${MAX_PREFERENCES} unidades escolhidas, na ordem mostrada acima.`}
      </p>
    </section>
  );
}

function distanceLabel(kind: string): string {
  if (kind === 'RESIDENCIA') return 'Da residência';
  if (kind === 'TRABALHO') return 'Do trabalho';
  if (kind === 'REDE_APOIO') return 'Da rede de apoio';
  return 'Do ponto informado';
}
