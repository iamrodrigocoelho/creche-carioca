import { loadTestEnv } from './env';

// Executa em cada worker do Vitest, antes dos testes: o `globalSetup` roda em
// outro processo e sua mutacao de `process.env` nao chega ate aqui.
loadTestEnv();
