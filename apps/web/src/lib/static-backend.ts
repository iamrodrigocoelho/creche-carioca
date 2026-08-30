import {
  DEMO_AGE_GROUP_POLICY_2026,
  findAgeGroupPolicy,
  flagDuplicateCeps,
  RESIDENCE_POSITION,
  resolveAgeGroup,
  resolveAnchorPosition,
  type AnchorRuleViolation,
} from '@match/domain';
import { resolveCepSector } from '@match/geo';
import {
  createLocationAnchorSchema,
  toAgeGroupResult,
  type ApiError,
  type ApplicationResponse,
  type CreateApplicationInput,
  type CreateLocationAnchorInput,
  type LocationAnchorListResponse,
  type LocationAnchorResponse,
} from '@match/schemas';

/**
 * Backend do modo estatico (ADR-0027).
 *
 * A publicacao estatica nao tem servidor nem banco: a jornada inteira roda no
 * navegador. Nada aqui reimplementa regra — grupamento, geocodificacao,
 * posicionamento e duplicidade vem de `@match/domain` e `@match/geo`, os mesmos
 * modulos que a API usa. O que este arquivo faz e substituir o PostgreSQL por
 * `localStorage` e montar as mesmas respostas.
 *
 * O que se perde e real e esta documentado em `docs/DEPLOY-ESTATICO.md`:
 * nao ha trilha de auditoria, nao ha validacao do lado do servidor e nao ha
 * rate limiting. Os dados ficam no dispositivo de quem visita, e so.
 */

const STORAGE_KEY = 'match-perfeito:static:v1';

interface StoredAnchor {
  id: string;
  position: number;
  kind: LocationAnchorResponse['kind'];
  cep: string;
  label: string | null;
  status: LocationAnchorResponse['status'];
  latitude: number | null;
  longitude: number | null;
  precisionKm: number | null;
  neighborhood: string | null;
  lastValidatedAt: string;
}

interface StoredApplication {
  id: string;
  anonymousChildId: string;
  processId: string;
  birthYear: number;
  birthMonth: number;
  sex?: ApplicationResponse['child']['sex'];
  desiredShift: ApplicationResponse['desiredShift'];
  referenceDate?: string;
  createdAt: string;
  updatedAt: string;
  anchors: StoredAnchor[];
}

type Store = Record<string, StoredApplication>;

export type StaticResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: ApiError['error'] };

function failure(code: string, message: string): { ok: false; error: ApiError['error'] } {
  // Sem servidor nao ha correlation ID de verdade; dizer isso e melhor que
  // inventar um identificador que nao leva a lugar nenhum.
  return { ok: false, error: { code, message, correlationId: 'modo-estatico' } };
}

function readStore(): Store {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    // Armazenamento indisponivel (navegacao privada, cota cheia) nao pode
    // derrubar a demonstracao: segue em memoria pelo tempo da sessao.
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* mesma razao do readStore */
  }
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

function toApplicationResponse(stored: StoredApplication): ApplicationResponse {
  const policy = findAgeGroupPolicy(stored.processId) ?? DEMO_AGE_GROUP_POLICY_2026;
  const resolution = resolveAgeGroup({
    birthYear: stored.birthYear,
    birthMonth: stored.birthMonth,
    policy,
    ...(stored.referenceDate ? { referenceDate: stored.referenceDate } : {}),
  });

  return {
    id: stored.id,
    anonymousChildId: stored.anonymousChildId,
    status: 'RASCUNHO',
    processId: stored.processId,
    child: {
      birthYear: stored.birthYear,
      birthMonth: stored.birthMonth,
      ...(stored.sex ? { sex: stored.sex } : {}),
    },
    desiredShift: stored.desiredShift,
    ageGroup: toAgeGroupResult(resolution),
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

function toAnchorList(stored: StoredApplication): LocationAnchorListResponse {
  const ordered = [...stored.anchors].sort((a, b) => a.position - b.position);
  return {
    applicationId: stored.id,
    anchors: flagDuplicateCeps(ordered),
    hasResidence: ordered.some((anchor) => anchor.position === RESIDENCE_POSITION),
  };
}

const VIOLATION_MESSAGES: Readonly<Record<AnchorRuleViolation, string>> = {
  ANCHOR_LIMIT_REACHED:
    'São no máximo três pontos de referência. Remova um antes de adicionar outro.',
  ANCHOR_POSITION_MISMATCH: 'O primeiro ponto de referência é o CEP de residência.',
};

export function createApplicationLocally(
  input: CreateApplicationInput,
): StaticResult<ApplicationResponse> {
  if (findAgeGroupPolicy(input.processId) === undefined) {
    return failure('UNKNOWN_PROCESS', 'Processo seletivo não encontrado.');
  }

  const now = new Date().toISOString();
  const stored: StoredApplication = {
    id: newId(),
    anonymousChildId: newId(),
    processId: input.processId,
    birthYear: input.child.birthYear,
    birthMonth: input.child.birthMonth,
    ...(input.child.sex ? { sex: input.child.sex } : {}),
    desiredShift: input.desiredShift,
    ...(input.referenceDate ? { referenceDate: input.referenceDate } : {}),
    createdAt: now,
    updatedAt: now,
    anchors: [],
  };

  const store = readStore();
  store[stored.id] = stored;
  writeStore(store);

  return { ok: true, data: toApplicationResponse(stored) };
}

export function listAnchorsLocally(
  applicationId: string,
): StaticResult<LocationAnchorListResponse> {
  const stored = readStore()[applicationId];
  if (!stored) return failure('APPLICATION_NOT_FOUND', 'Inscrição não encontrada.');
  return { ok: true, data: toAnchorList(stored) };
}

export function upsertAnchorLocally(
  applicationId: string,
  input: CreateLocationAnchorInput,
): StaticResult<LocationAnchorListResponse> {
  const store = readStore();
  const stored = store[applicationId];
  if (!stored) return failure('APPLICATION_NOT_FOUND', 'Inscrição não encontrada.');

  // O MESMO schema que a API aplica no limite, inclusive a normalizacao do CEP.
  const parsed = createLocationAnchorSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return failure('VALIDATION_FAILED', first?.message ?? 'Dados inválidos.');
  }

  const decided = resolveAnchorPosition({
    requested: parsed.data.position,
    kind: parsed.data.kind,
    taken: stored.anchors.map((anchor) => anchor.position),
  });
  if (!decided.ok) {
    return failure(decided.violation, VIOLATION_MESSAGES[decided.violation]);
  }

  const sector = resolveCepSector(parsed.data.cep);
  const anchor: StoredAnchor = {
    id: stored.anchors.find((item) => item.position === decided.position)?.id ?? newId(),
    position: decided.position,
    kind: parsed.data.kind,
    cep: parsed.data.cep,
    label: parsed.data.label ?? null,
    status: sector ? 'RESOLVIDO' : 'FALHOU',
    latitude: sector?.lat ?? null,
    longitude: sector?.lon ?? null,
    precisionKm: sector?.precisionKm ?? null,
    neighborhood: sector?.bairro ?? null,
    lastValidatedAt: new Date().toISOString(),
  };

  stored.anchors = [...stored.anchors.filter((item) => item.position !== decided.position), anchor];
  stored.updatedAt = new Date().toISOString();
  writeStore(store);

  return { ok: true, data: toAnchorList(stored) };
}

export function removeAnchorLocally(
  applicationId: string,
  position: number,
): StaticResult<LocationAnchorListResponse> {
  const store = readStore();
  const stored = store[applicationId];
  if (!stored) return failure('APPLICATION_NOT_FOUND', 'Inscrição não encontrada.');

  if (position === RESIDENCE_POSITION) {
    return failure(
      'RESIDENCE_ANCHOR_REQUIRED',
      'O CEP de residência é obrigatório e não pode ser removido.',
    );
  }

  const before = stored.anchors.length;
  stored.anchors = stored.anchors.filter((anchor) => anchor.position !== position);
  if (stored.anchors.length === before) {
    return failure('ANCHOR_NOT_FOUND', 'Ponto de referência não encontrado.');
  }

  stored.updatedAt = new Date().toISOString();
  writeStore(store);
  return { ok: true, data: toAnchorList(stored) };
}

/** Apaga tudo que a demonstracao guardou no dispositivo. */
export function clearLocalData(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* nada a fazer se o armazenamento nao esta disponivel */
  }
}
