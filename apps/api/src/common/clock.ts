/**
 * Relogio injetavel.
 *
 * PRD 14.3 exige "worker processando jobs atrasados com relogio controlado" e a
 * maquina de estados da convocacao (Fase 11) precisa de tempo deterministico nos
 * testes. Nenhum servico deve chamar `new Date()` diretamente.
 */
export type Clock = () => Date;

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = () => new Date();
