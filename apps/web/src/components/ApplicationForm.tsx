'use client';

import { useEffect, useRef, useState } from 'react';

import { Button, ErrorSummary, SelectField } from '@match/ui';
import type { ApiError, ApplicationResponse, FieldIssue } from '@match/schemas';

import { createApplication, newIdempotencyKey } from '@/lib/api-client';
import {
  EMPTY_DRAFT,
  MONTH_OPTIONS,
  SEX_OPTIONS,
  SHIFT_OPTIONS,
  clearDraft,
  readDraft,
  validateDraft,
  writeDraft,
  type ApplicationDraft,
} from '@/lib/form';
import { AgeGroupResult } from './AgeGroupResult';
import { ContactsStep } from './ContactsStep';
import { LocationAnchorsStep } from './LocationAnchorsStep';

/**
 * Etapa 1 da jornada da familia (RF-01, fatia da Fase 1).
 *
 * PRD 20 exige os quatro estados: vazio (formulario), carregando, erro e sucesso.
 * PRD 17 exige validacao inline, resumo de erros e operacao por teclado.
 */

type FormState =
  | { readonly kind: 'editing' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'failed'; readonly error: ApiError['error'] }
  | { readonly kind: 'succeeded'; readonly application: ApplicationResponse };

export function ApplicationForm() {
  const [draft, setDraft] = useState<ApplicationDraft>(EMPTY_DRAFT);
  const [issues, setIssues] = useState<readonly FieldIssue[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  const [state, setState] = useState<FormState>({ kind: 'editing' });

  const summaryRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Restaura o rascunho apos a hidratacao, para nao divergir do HTML do servidor.
  useEffect(() => {
    setDraft(readDraft(globalThis.localStorage));
  }, []);

  function update(field: keyof ApplicationDraft, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    writeDraft(globalThis.localStorage, next);

    // Limpa o erro do campo assim que a pessoa corrige, sem revalidar o resto.
    if (fieldErrors[field]) {
      const { [field]: _removed, ...rest } = fieldErrors;
      setFieldErrors(rest);
      setIssues(issues.filter((issue) => issue.path !== field));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateDraft(draft);
    if (!validation.ok) {
      setIssues(validation.issues);
      setFieldErrors(validation.byField);
      // Move o foco para o resumo, requisito de ordem de foco previsivel (PRD 14.7).
      queueMicrotask(() => summaryRef.current?.focus());
      return;
    }

    setIssues([]);
    setFieldErrors({});
    setState({ kind: 'submitting' });

    const result = await createApplication(validation.value, {
      idempotencyKey: newIdempotencyKey(),
    });

    if (!result.ok) {
      setState({ kind: 'failed', error: result.error });
      return;
    }

    clearDraft(globalThis.localStorage);
    setState({ kind: 'succeeded', application: result.data });
    queueMicrotask(() => resultRef.current?.focus());
  }

  if (state.kind === 'succeeded') {
    return (
      <div className="mp-stack-lg" ref={resultRef} tabIndex={-1}>
        <AgeGroupResult application={state.application} />
        <div className="mp-actions">
          <Button
            variant="secondary"
            onClick={() => {
              setDraft(EMPTY_DRAFT);
              setState({ kind: 'editing' });
            }}
          >
            Simular outra criança
          </Button>
        </div>
        <LocationAnchorsStep applicationId={state.application.id} />
        <ContactsStep applicationId={state.application.id} />
        <p className="mp-caption mp-muted">
          A próxima etapa — a escolha de unidades — ainda está em construção nesta demonstração.
        </p>
      </div>
    );
  }

  const submitting = state.kind === 'submitting';

  return (
    <form className="mp-form" onSubmit={handleSubmit} noValidate>
      <div ref={summaryRef} tabIndex={-1}>
        <ErrorSummary issues={issues} />
      </div>

      {state.kind === 'failed' ? (
        <div className="mp-error-summary" role="alert">
          <p className="mp-caption-strong">Não foi possível enviar</p>
          <p className="mp-caption">{state.error.message}</p>
          <p className="mp-micro-legal">Código de referência: {state.error.correlationId}</p>
        </div>
      ) : null}

      <SelectField
        id="birthMonth"
        label="Mês de nascimento da criança"
        hint="Não pedimos o dia — mês e ano são suficientes para calcular o grupamento."
        {...(fieldErrors.birthMonth ? { error: fieldErrors.birthMonth } : {})}
        value={draft.birthMonth}
        onChange={(event) => update('birthMonth', event.target.value)}
        required
      >
        <option value="">Selecione o mês</option>
        {MONTH_OPTIONS.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        id="birthYear"
        label="Ano de nascimento da criança"
        {...(fieldErrors.birthYear ? { error: fieldErrors.birthYear } : {})}
        value={draft.birthYear}
        onChange={(event) => update('birthYear', event.target.value)}
        required
      >
        <option value="">Selecione o ano</option>
        {YEAR_OPTIONS.map((year) => (
          <option key={year} value={String(year)}>
            {year}
          </option>
        ))}
      </SelectField>

      <fieldset className="mp-fieldset">
        <legend className="mp-field__label">Turno desejado</legend>
        <p className="mp-field__hint" id="desiredShift-hint">
          Integral é o dia todo; parcial é meio período.
        </p>
        <div className="mp-radio-row" id="desiredShift">
          {SHIFT_OPTIONS.map((shift) => (
            <label
              key={shift.value}
              className={['mp-chip', draft.desiredShift === shift.value ? 'mp-chip--selected' : '']
                .filter(Boolean)
                .join(' ')}
            >
              <input
                className="mp-chip__input"
                type="radio"
                name="desiredShift"
                value={shift.value}
                checked={draft.desiredShift === shift.value}
                onChange={(event) => update('desiredShift', event.target.value)}
                aria-describedby="desiredShift-hint"
              />
              {shift.label}
            </label>
          ))}
        </div>
        {fieldErrors.desiredShift ? (
          <span className="mp-field__error" id="desiredShift-error">
            <span aria-hidden="true">!</span>
            <span>
              <span className="mp-visually-hidden">Erro: </span>
              {fieldErrors.desiredShift}
            </span>
          </span>
        ) : null}
      </fieldset>

      <SelectField
        id="sex"
        label="Sexo da criança (opcional)"
        hint="Este campo é opcional e não afeta o grupamento nem a pontuação."
        value={draft.sex}
        onChange={(event) => update('sex', event.target.value)}
      >
        {SEX_OPTIONS.map((option) => (
          <option key={option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <div className="mp-actions">
        <Button type="submit" variant="store-hero" disabled={submitting}>
          {submitting ? 'Calculando…' : 'Calcular grupamento'}
        </Button>
      </div>

      {submitting ? (
        <p className="mp-status" role="status">
          Enviando os dados e aplicando a regra vigente…
        </p>
      ) : null}

      <p className="mp-micro-legal">
        Não informe dados reais. Esta é uma demonstração e utiliza apenas informações sintéticas.
      </p>
    </form>
  );
}

/**
 * Anos oferecidos no seletor. A janela cobre a faixa de creche com folga; a
 * validacao definitiva permanece no schema compartilhado e no domínio.
 */
const CURRENT_DEMO_YEAR = 2026;
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, index) => CURRENT_DEMO_YEAR - index);
