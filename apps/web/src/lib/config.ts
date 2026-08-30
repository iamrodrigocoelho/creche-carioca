/**
 * URL da API. Sem segredo: apenas um endpoint publico configuravel (PRD 13.4).
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

/** Processo seletivo usado na demonstracao (PRD 5: o processo de 2026 nao esta nos datasets). */
export const DEMO_PROCESS_ID = 'DEMO-2026';

/**
 * Modo estatico (ADR-0027).
 *
 * Quando ligado, a jornada roda inteiramente no navegador: nao ha chamada de
 * rede, nao ha servidor e nao ha banco. Serve para publicar a demonstracao em
 * hospedagem de arquivos estaticos, como a Hostinger.
 *
 * A leitura e uma comparacao literal porque o Next substitui
 * `process.env.NEXT_PUBLIC_*` em tempo de build; uma expressao mais elaborada
 * nao seria eliminada do bundle.
 */
export const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC_MODE === 'true';
