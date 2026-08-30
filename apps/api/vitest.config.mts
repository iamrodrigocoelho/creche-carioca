import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * O NestJS depende de `emitDecoratorMetadata` para resolver dependencias por tipo.
 * O esbuild do Vitest nao emite esses metadados, entao a transformacao usa SWC.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/**/*.module.ts'],
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
