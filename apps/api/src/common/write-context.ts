/**
 * Contexto de rastreabilidade propagado ate a escrita.
 *
 * PRD 8.16 exige ator, papel, correlation ID e origem em todo evento relevante.
 * Carregar isso explicitamente evita que a camada de persistencia precise
 * adivinhar quem originou a operacao.
 *
 * Vive em `common/` porque toda porta de escrita a partir da Fase 4 depende
 * dele; nasceu junto da porta de inscricao, na Fase 2.
 */
export interface WriteContext {
  readonly correlationId: string;
  readonly actor: string;
  readonly actorRole: string;
}

/**
 * Ator das operacoes anonimas da familia.
 *
 * A autenticacao e simulada e so entra na Fase 10 (B-05). Ate la nenhum ator
 * real e afirmado: gravar "anonimo" e mais honesto que inventar um usuario.
 */
export const ANONYMOUS_ACTOR: Omit<WriteContext, 'correlationId'> = {
  actor: 'anonimo',
  actorRole: 'PUBLICO',
};
