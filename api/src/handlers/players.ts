import {
  isRoomCode,
  type CreatePlayerResponse,
  type MeResponse,
  type RenameInRoomResponse,
  type RenamePlayerRequest,
  type RenamePlayerResponse,
} from '@family-night/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { createPlayer, getMe, renamePlayer } from '../services/players.ts';
import { parseBody, requirePlayer, type AppEnv } from './context.ts';

const renameSchema: z.ZodType<RenamePlayerRequest> = z.object({
  name: z.string().max(200),
  roomCode: z.string().refine(isRoomCode).optional(),
});

export function playersRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .post('/', async (c) => c.json<CreatePlayerResponse>(await createPlayer(deps)))
    .get('/me', requirePlayer(deps), async (c) =>
      c.json<MeResponse>(await getMe(deps, c.get('player'))),
    )
    .patch('/me', requirePlayer(deps), async (c) => {
      const body = await parseBody(c, renameSchema);
      return c.json<RenamePlayerResponse | RenameInRoomResponse>(
        await renamePlayer(deps, c.get('player'), body),
      );
    });
}
