import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environmentMatchGlobs: [
      ['components/**/*.test.tsx', 'jsdom'],
    ],
  },
});
