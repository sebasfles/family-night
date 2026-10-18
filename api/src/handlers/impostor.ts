import type { RoomResponse, VoteRequest } from '@family-night/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { playerIdSchema } from '../lib/auth.ts';
import { castVote, closeVotingCommand } from '../services/impostor/index.ts';
import {
  matchIdParam,
  parseBody,
  roomCodeParam,
  roundNumber,
  roundSchema,
  type AppEnv,
} from './context.ts';

const voteSchema: z.ZodType<VoteRequest> = z.object({
  round: roundNumber,
  targetId: playerIdSchema,
  confirmed: z.boolean(),
});

export function impostorRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .put('/:code/matches/:matchId/votes', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, voteSchema);
      return c.json<RoomResponse>({
        room: await castVote(deps, c.get('player'), code, matchId, body),
      });
    })
    .post('/:code/matches/:matchId/close-voting', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, roundSchema);
      return c.json<RoomResponse>({
        room: await closeVotingCommand(deps, c.get('player'), code, matchId, body),
      });
    });
}
