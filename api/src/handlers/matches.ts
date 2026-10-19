import type { MatchSecretResponse, RoomResponse } from '@family-night/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import {
  abortMatch,
  backToLobby,
  mySecret,
  nextRound,
  rematch,
  startMatch,
  updateConfig,
  type ConfigBody,
} from '../services/matches/index.ts';
import { matchIdParam, parseBody, roomCodeParam, roundSchema, type AppEnv } from './context.ts';

const configBodySchema: z.ZodType<ConfigBody> = z.object({
  gameType: z.enum(['IMPOSTOR', 'WAVELENGTH', 'JUST_ONE', 'MANADA']),
  config: z.unknown(),
});

export function matchesRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .post('/:code/matches', async (c) => {
      const code = roomCodeParam(c);
      const body = await parseBody(c, configBodySchema);
      return c.json<RoomResponse>(
        { room: await startMatch(deps, c.get('player'), code, body) },
        201,
      );
    })
    .put('/:code/config', async (c) => {
      const code = roomCodeParam(c);
      const body = await parseBody(c, configBodySchema);
      return c.json<RoomResponse>({ room: await updateConfig(deps, c.get('player'), code, body) });
    })
    .post('/:code/lobby', async (c) =>
      c.json<RoomResponse>({ room: await backToLobby(deps, c.get('player'), roomCodeParam(c)) }),
    )
    .get('/:code/matches/:matchId/me', async (c) =>
      c.json<MatchSecretResponse>(
        await mySecret(deps, c.get('player'), roomCodeParam(c), matchIdParam(c)),
      ),
    )
    .post('/:code/matches/:matchId/abort', async (c) =>
      c.json<RoomResponse>({
        room: await abortMatch(deps, c.get('player'), roomCodeParam(c), matchIdParam(c)),
      }),
    )
    .post('/:code/matches/:matchId/next-round', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, roundSchema);
      return c.json<RoomResponse>({
        room: await nextRound(deps, c.get('player'), code, matchId, body),
      });
    })
    .post('/:code/matches/:matchId/rematch', async (c) =>
      c.json<RoomResponse>({
        room: await rematch(deps, c.get('player'), roomCodeParam(c), matchIdParam(c)),
      }),
    );
}
