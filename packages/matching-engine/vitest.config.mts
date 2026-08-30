import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      // PRD 14.1 e o plano da Fase 7 exigem 90% neste pacote: e ele que decide
      // numeros que afetam a vida de familias.
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
