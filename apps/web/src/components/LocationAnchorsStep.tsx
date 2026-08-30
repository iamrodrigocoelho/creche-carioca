'use client';

import { useEffect, useRef, useState } from 'react';

import { Button, TextField } from '@match/ui';
import { formatCep } from '@match/domain';
import type {
  AnchorKind,
  ApiError,
  LocationAnchorListResponse,
  LocationAnchorResponse,
} from '@match/schemas';

import { listLocationAnchors, removeLocationAnchor, upsertLocationAnchor } from '@/lib/api-client';

/**
 * Etapa 2 da jornada da familia (RF-02, PRD 8.2).
 *
 * A residencia e obrigatoria; os outros dois pontos sao opcionais e podem ser
 * removidos. Nada aqui altera a pontuacao — a interface diz isso em voz alta,
 * porque uma familia que teme ser prejudicada simplesmente nao informa o
 * segundo endereco, e a recomendacao piora para ela.
 */

const KIND_LABELS: Readonly<Record<AnchorKind, string>> = {
  RESIDENCIA: 'Residência',
  TRABALHO: 'Trabalho',
  REDE_APOIO: 'Rede de apoio',
  OUTRO: 'Outro',
};

/** Tipos oferecidos para os pontos opcionais. A residencia e sempre a primeira. */
const OPTIONAL_KINDS: readonly AnchorKind[] = ['TRABALHO', 'REDE_APOIO', 'OUTRO'];

const MAX_ANCHORS = 3;

interface Props {
  readonly applicationId: string;
  /**
   * Avisa que os pontos mudaram. A etapa 4 depende deles para calcular
   * distancias, e sem esse aviso continuaria mostrando a lista carregada antes
   * de a familia informar o primeiro CEP.
   */
  readonly onChange?: () => void;
}

export function LocationAnchorsStep({ applicationId, onChange }: Props) {
  const [anchors, setAnchors] = useState<readonly LocationAnchorResponse[]>([]);
  const [hasResidence, setHasResidence] = useState(false);
  const [cep, setCep] = useState('');
  const [kind, setKind] = useState<AnchorKind>('RESIDENCIA');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError['error'] | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let active = true;
    void listLocationAnchors(applicationId).then((result) => {
      // Só a lista. Limpar o formulário aqui apagaria o que a pessoa já tivesse
      // digitado enquanto a carga inicial não terminava — e ela terminaria
      // depois em qualquer conexão lenta ou página cheia.
      if (active && result.ok) showList(result.data);
    });
    return () => {
      active = false;
    };
  }, [applicationId]);

  function showList(data: LocationAnchorListResponse) {
    setAnchors(data.anchors);
    setHasResidence(data.hasResidence);
    // O proximo ponto nunca e outra residencia: ela ocupa a primeira posicao.
    setKind(data.hasResidence ? 'TRABALHO' : 'RESIDENCIA');
  }

  /** Após uma escrita: além da lista, limpa o formulário e avisa a etapa 4. */
  function apply(data: LocationAnchorListResponse) {
    showList(data);
    setCep('');
    setLabel('');
    onChange?.();
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await upsertLocationAnchor(applicationId, {
      cep,
      kind,
      ...(label.trim() ? { label: label.trim() } : {}),
    });

    setBusy(false);
    if (result.ok) {
      apply(result.data);
      queueMicrotask(() => statusRef.current?.focus());
    } else {
      setError(result.error);
    }
  }

  async function handleRemove(position: number) {
    setBusy(true);
    setError(null);
    const result = await removeLocationAnchor(applicationId, position);
    setBusy(false);
    if (result.ok) apply(result.data);
    else setError(result.error);
  }

  const full = anchors.length >= MAX_ANCHORS;

  return (
    <section className="mp-card mp-stack-md" aria-labelledby="anchors-title">
      <h3 id="anchors-title">Pontos de referência</h3>
      <p className="mp-caption">
        Informe o CEP de residência e, se quiser, até dois outros pontos — o trabalho ou a casa de
        alguém que ajuda com a criança. Usamos isso apenas para sugerir unidades mais perto de você.
      </p>
      <p className="mp-caption-strong">Os pontos de referência não alteram a pontuação.</p>

      {anchors.length > 0 ? (
        <ul className="mp-anchor-list">
          {anchors.map((anchor) => (
            <li key={anchor.id} className="mp-anchor mp-stack-xs">
              <span className="mp-caption-strong">{KIND_LABELS[anchor.kind]}</span>
              <span className="mp-body-strong">{formatCep(anchor.cep)}</span>
              {anchor.label ? <span className="mp-caption">{anchor.label}</span> : null}

              {anchor.status === 'RESOLVIDO' ? (
                <span className="mp-caption mp-muted">
                  {anchor.neighborhood ?? 'Localização encontrada'} — posição aproximada, com margem
                  de cerca de {formatKm(anchor.precisionKm)}.
                </span>
              ) : (
                <span className="mp-caption mp-muted" role="note">
                  Não localizamos este CEP no mapa. Você ainda poderá escolher unidades por bairro
                  ou pelo nome.
                </span>
              )}

              {anchor.duplicateOfPosition !== null ? (
                <span className="mp-caption mp-muted">
                  {`Este CEP é igual ao do ponto ${anchor.duplicateOfPosition}. Pode continuar assim, se for o caso.`}
                </span>
              ) : null}

              {anchor.position === 1 ? null : (
                <Button
                  variant="secondary"
                  onClick={() => void handleRemove(anchor.position)}
                  disabled={busy}
                >
                  Remover {KIND_LABELS[anchor.kind].toLowerCase()}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {full ? (
        <p className="mp-caption mp-muted">
          Você já informou os três pontos permitidos. Remova um para trocar.
        </p>
      ) : (
        <form className="mp-form" onSubmit={handleAdd} noValidate>
          <TextField
            id="anchor-cep"
            label={hasResidence ? 'CEP do novo ponto' : 'CEP de residência'}
            hint="Somente números ou no formato 00000-000."
            inputMode="numeric"
            autoComplete={hasResidence ? 'off' : 'postal-code'}
            value={cep}
            onChange={(event) => setCep(event.target.value)}
            required
          />

          {hasResidence ? (
            <fieldset className="mp-fieldset">
              <legend className="mp-field__label">Tipo do ponto</legend>
              <div className="mp-radio-row">
                {OPTIONAL_KINDS.map((option) => (
                  <label
                    key={option}
                    className={['mp-chip', kind === option ? 'mp-chip--selected' : '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <input
                      className="mp-chip__input"
                      type="radio"
                      name="anchor-kind"
                      value={option}
                      checked={kind === option}
                      onChange={() => setKind(option)}
                    />
                    {KIND_LABELS[option]}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <TextField
            id="anchor-label"
            label="Rótulo (opcional)"
            hint="Um nome curto para você reconhecer o ponto, como “casa da avó”."
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />

          <div className="mp-actions">
            <Button type="submit" disabled={busy}>
              {busy ? 'Salvando…' : hasResidence ? 'Adicionar ponto' : 'Salvar CEP de residência'}
            </Button>
          </div>
        </form>
      )}

      {error ? (
        <div className="mp-error-summary" role="alert">
          <p className="mp-caption-strong">Não foi possível salvar</p>
          <p className="mp-caption">{error.message}</p>
          <p className="mp-micro-legal">Código de referência: {error.correlationId}</p>
        </div>
      ) : null}

      <p ref={statusRef} className="mp-status" role="status" tabIndex={-1}>
        {hasResidence
          ? 'CEP de residência salvo. Você já pode seguir com a inscrição.'
          : 'Informe o CEP de residência para concluir esta etapa.'}
      </p>
    </section>
  );
}

/** Arredonda para uma casa e usa metros abaixo de 1 km, que é como se fala. */
function formatKm(precisionKm: number | null): string {
  if (precisionKm === null) return 'alguns quilômetros';
  if (precisionKm < 1) return `${Math.round(precisionKm * 1000)} metros`;
  return `${precisionKm.toFixed(1).replace('.', ',')} km`;
}
