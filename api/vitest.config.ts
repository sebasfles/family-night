import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globalSetup: ['src/test/dynamo-local.ts'],
    fileParallelism: false,
    silent: 'passed-only',
  },
});
