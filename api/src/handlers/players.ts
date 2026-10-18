import type { CreatePlayerResponse, MeResponse } from '@family-night/shared';
import { Hono } from 'hono';
import type { Deps } from '../deps.ts';
import { createPlayer, getMe } from '../services/players.ts';
import { requirePlayer, type AppEnv } from './context.ts';

export function playersRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .post('/', async (c) => c.json<CreatePlayerResponse>(await createPlayer(deps)))
    .get('/me', requirePlayer(deps), async (c) =>
      c.json<MeResponse>(await getMe(deps, c.get('player'))),
    );
}
