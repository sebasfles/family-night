import type { LeaveRoomResponse, RoomResponse, TargetPlayerRequest } from '@family-night/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { playerIdSchema } from '../lib/auth.ts';
import { markAway, ping } from '../services/presence.ts';
import {
  createRoom,
  getRoom,
  handOverHost,
  joinRoom,
  kickMember,
  leaveRoom,
} from '../services/rooms.ts';
import { parseBody, requirePlayer, roomCodeParam, type AppEnv } from './context.ts';
import { impostorRoutes } from './impostor.ts';
import { justOneRoutes } from './justone.ts';
import { matchesRoutes } from './matches.ts';
import { sharedMatchRoutes } from './shared-match.ts';
import { wavelengthRoutes } from './wavelength.ts';

const targetSchema: z.ZodType<TargetPlayerRequest> = z.object({ playerId: playerIdSchema });

export function roomsRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .use(requirePlayer(deps))
    .post('/', async (c) =>
      c.json<RoomResponse>({ room: await createRoom(deps, c.get('player')) }, 201),
    )
    .get('/:code', async (c) =>
      c.json<RoomResponse>({ room: await getRoom(deps, c.get('player'), roomCodeParam(c)) }),
    )
    .post('/:code/join', async (c) =>
      c.json<RoomResponse>({ room: await joinRoom(deps, c.get('player'), roomCodeParam(c)) }),
    )
    .post('/:code/leave', async (c) => {
      await leaveRoom(deps, c.get('player'), roomCodeParam(c));
      return c.json<LeaveRoomResponse>({ ok: true });
    })
    .post('/:code/ping', async (c) =>
      c.json<RoomResponse>({ room: await ping(deps, c.get('player'), roomCodeParam(c)) }),
    )
    .post('/:code/away', async (c) => {
      await markAway(deps, c.get('player'), roomCodeParam(c));
      return c.body(null, 204);
    })
    .post('/:code/kick', async (c) => {
      const code = roomCodeParam(c);
      const { playerId } = await parseBody(c, targetSchema);
      return c.json<RoomResponse>({
        room: await kickMember(deps, c.get('player'), code, playerId),
      });
    })
    .post('/:code/host', async (c) => {
      const code = roomCodeParam(c);
      const { playerId } = await parseBody(c, targetSchema);
      return c.json<RoomResponse>({
        room: await handOverHost(deps, c.get('player'), code, playerId),
      });
    })
    .route('/', matchesRoutes(deps))
    .route('/', sharedMatchRoutes(deps))
    .route('/', impostorRoutes(deps))
    .route('/', wavelengthRoutes(deps))
    .route('/', justOneRoutes(deps));
}
