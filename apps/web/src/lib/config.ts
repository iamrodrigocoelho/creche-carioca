/**
 * URL da API. Sem segredo: apenas um endpoint publico configuravel (PRD 13.4).
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

/** Processo seletivo usado na demonstracao (PRD 5: o processo de 2026 nao esta nos datasets). */
export const DEMO_PROCESS_ID = 'DEMO-2026';
