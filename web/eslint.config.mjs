import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import { base } from '../eslint.config.base.mjs';

export default defineConfig(
  base(import.meta.dirname),
  { ignores: ['src/routeTree.gen.ts'] },
  reactHooks.configs.flat.recommended,
  reactRefresh.configs.vite,
  {
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/routes/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
