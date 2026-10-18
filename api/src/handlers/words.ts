import type { WordCategoriesResponse } from '@family-night/shared';
import { Hono } from 'hono';
import type { Deps } from '../deps.ts';
import { wordCategories } from '../services/impostor/words.ts';
import { requirePlayer, type AppEnv } from './context.ts';

export function wordsRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .use(requirePlayer(deps))
    .get('/categories', (c) => c.json<WordCategoriesResponse>({ categories: wordCategories }));
}
