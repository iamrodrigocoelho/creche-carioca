import {
  createApplicationSchema,
  type CreateApplicationInput,
  type FieldIssue,
} from '@match/schemas';

import { DEMO_PROCESS_ID } from './config';

/**
 * Validacao do formulario da etapa 1.
 *
 * Funcoes puras, para que a regra seja testavel sem DOM. O schema e o MESMO que
 * a API aplica no limite (PRD 13.5) - a validacao no cliente existe para dar
 * retorno imediato, nunca como unico controle.
 */

export interface ApplicationDraft {
  readonly birthMonth: string;
  readonly birthYear: string;
  readonly desiredShift: string;
  readonly sex: string;
}

export const EMPTY_DRAFT: ApplicationDraft = {
  birthMonth: '',
  birthYear: '',
  desiredShift: '',
  sex: '',
};

/** Caminho do schema -> id do campo no formulario, usado nos ancoras do resumo de erros. */
const FIELD_BY_PATH: Readonly<Record<string, string>> = {
  'child.birthMonth': 'birthMonth',
  'child.birthYear': 'birthYear',
  desiredShift: 'desiredShift',
  'child.sex': 'sex',
};

export function fieldIdForPath(path: string): string {
  return FIELD_BY_PATH[path] ?? path;
}

/** Converte texto do formulario em numero, preservando `NaN` para o schema recusar. */
function toNumber(value: string): number {
  return value.trim() === '' ? Number.NaN : Number(value);
}

export type ValidationResult =
  | { readonly ok: true; readonly value: CreateApplicationInput }
  | {
      readonly ok: false;
      readonly issues: readonly FieldIssue[];
      readonly byField: Readonly<Record<string, string>>;
    };

export function validateDraft(draft: ApplicationDraft): ValidationResult {
  const candidate = {
    processId: DEMO_PROCESS_ID,
    child: {
      birthYear: toNumber(draft.birthYear),
      birthMonth: toNumber(draft.birthMonth),
      ...(draft.sex ? { sex: draft.sex } : {}),
    },
    desiredShift: draft.desiredShift,
  };

  const result = createApplicationSchema.safeParse(candidate);
  if (result.success) return { ok: true, value: result.data };

  const issues: FieldIssue[] = [];
  const byField: Record<string, string> = {};

  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    const field = fieldIdForPath(path);
    // Mantem apenas a primeira mensagem por campo, para nao repetir no resumo.
    if (byField[field] !== undefined) continue;
    byField[field] = issue.message;
    issues.push({ path: field, message: issue.message });
  }

  return { ok: false, issues, byField };
}

export const DRAFT_STORAGE_KEY = 'match-perfeito:rascunho:inscricao';

/**
 * PRD 8.1: "O formulario deve salvar rascunho local ou no backend de demonstracao."
 * PRD 17: "Preservar progresso do formulario."
 *
 * Apenas mes/ano de nascimento, turno e sexo sao guardados. Nenhum dado pessoal
 * direto e coletado nesta etapa (PRD 13.2, minimizacao).
 */
export function readDraft(storage: Storage | undefined): ApplicationDraft {
  if (!storage) return EMPTY_DRAFT;

  try {
    const raw = storage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return EMPTY_DRAFT;

    const source = parsed as Record<string, unknown>;
    const pick = (key: keyof ApplicationDraft): string =>
      typeof source[key] === 'string' ? (source[key] as string).slice(0, 16) : '';

    return {
      birthMonth: pick('birthMonth'),
      birthYear: pick('birthYear'),
      desiredShift: pick('desiredShift'),
      sex: pick('sex'),
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function writeDraft(storage: Storage | undefined, draft: ApplicationDraft): void {
  if (!storage) return;
  try {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Armazenamento indisponivel (modo privado, cota). O formulario segue funcionando.
  }
}

export function clearDraft(storage: Storage | undefined): void {
  if (!storage) return;
  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Sem acao: limpar rascunho e melhor esforco.
  }
}

export const MONTH_OPTIONS = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
] as const;

export const SHIFT_OPTIONS = [
  { value: 'INTEGRAL', label: 'Integral', hint: 'A criança fica o dia todo.' },
  { value: 'PARCIAL', label: 'Parcial', hint: 'A criança fica meio período.' },
  { value: 'AMBOS', label: 'Tanto faz', hint: 'Aceito integral ou parcial.' },
] as const;

export const SEX_OPTIONS = [
  { value: '', label: 'Prefiro não informar' },
  { value: 'FEMININO', label: 'Feminino' },
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'NAO_INFORMADO', label: 'Não informado' },
] as const;
