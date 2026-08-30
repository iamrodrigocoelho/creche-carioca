import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * O NestJS depende de `emitDecoratorMetadata` para resolver dependencias por tipo.
 * O esbuild do Vitest nao emite esses metadados, entao a transformacao usa SWC.
 *
 * `globalSetup` aplica as migrations no banco de teste antes da suite; o arquivo
 * de setup redireciona `DATABASE_URL` para `DATABASE_URL_TEST` em cada worker.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: false,
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    // Um banco compartilhado nao tolera truncate concorrente entre arquivos.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/**/*.module.ts'],
    },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
