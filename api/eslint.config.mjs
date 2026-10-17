import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { base } from '../eslint.config.base.mjs';

export default defineConfig(base(import.meta.dirname), {
  languageOptions: { globals: globals.node },
});
