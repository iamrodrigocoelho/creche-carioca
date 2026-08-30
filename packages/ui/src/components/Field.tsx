import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

/**
 * Campos de formulario com validacao inline (PRD 17).
 *
 * ADR-0006: o DESIGN.md registra em "Known Gaps" que estados de erro nao foram
 * formalizados. Esta implementacao e provisoria e usa apenas tokens existentes.
 * O erro nunca depende so de cor: ha `aria-invalid`, `aria-describedby`, prefixo
 * textual "Erro:" e espessura de borda.
 */

export interface FieldShellProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: (ariaProps: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby': string | undefined;
  }) => ReactNode;
}

function describedBy(id: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [hasHint ? `${id}-hint` : '', hasError ? `${id}-error` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

export function FieldShell({ id, label, hint, error, children }: FieldShellProps) {
  return (
    <div className="mp-field">
      <label className="mp-field__label" htmlFor={id}>
        {label}
      </label>
      {hint ? (
        <span className="mp-field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {children({
        id,
        'aria-invalid': Boolean(error),
        'aria-describedby': describedBy(id, Boolean(hint), Boolean(error)),
      })}
      {error ? (
        <span className="mp-field__error" id={`${id}-error`}>
          <span aria-hidden="true">!</span>
          <span>
            <span className="mp-visually-hidden">Erro: </span>
            {error}
          </span>
        </span>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'className'
> {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
}

export function TextField({ id, label, hint, error, ...rest }: TextFieldProps) {
  return (
    <FieldShell id={id} label={label} {...(hint ? { hint } : {})} {...(error ? { error } : {})}>
      {(aria) => <input className="mp-field__control" {...aria} {...rest} />}
    </FieldShell>
  );
}

export interface SelectFieldProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'id' | 'className'
> {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: ReactNode;
}

export function SelectField({ id, label, hint, error, children, ...rest }: SelectFieldProps) {
  return (
    <FieldShell id={id} label={label} {...(hint ? { hint } : {})} {...(error ? { error } : {})}>
      {(aria) => (
        <select className="mp-field__control" {...aria} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export interface ErrorSummaryProps {
  readonly id?: string;
  readonly issues: readonly { readonly path: string; readonly message: string }[];
}

/** Resumo de erros exigido pelo PRD 17, com foco programatico e papel de alerta. */
export function ErrorSummary({ id = 'mp-error-summary', issues }: ErrorSummaryProps) {
  if (issues.length === 0) return null;

  return (
    <div className="mp-error-summary" id={id} role="alert" tabIndex={-1}>
      <p className="mp-caption-strong">
        {issues.length === 1
          ? 'Encontramos 1 problema no formulário:'
          : `Encontramos ${issues.length} problemas no formulário:`}
      </p>
      <ul className="mp-error-summary__list">
        {issues.map((issue) => (
          <li key={`${issue.path}-${issue.message}`} className="mp-caption">
            <a className="mp-link" href={`#${issue.path}`}>
              {issue.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
