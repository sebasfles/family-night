import type { GuessRequest, RoomResponse, RoundRequest, VoteRequest } from '@family-night/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { playerIdSchema } from '../lib/auth.ts';
import {
  castVote,
  closeVotingCommand,
  guessCommand,
  nextRoundCommand,
  skipGuessCommand,
} from '../services/impostor/index.ts';
import { matchIdParam, parseBody, roomCodeParam, type AppEnv } from './context.ts';

const roundSchema: z.ZodType<RoundRequest> = z.object({ round: z.int().min(1).max(99) });
const voteSchema: z.ZodType<VoteRequest> = z.object({
  round: z.int().min(1).max(99),
  targetId: playerIdSchema,
});
const guessSchema: z.ZodType<GuessRequest> = z.object({ option: z.string().min(1).max(100) });

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
    })
    .post('/:code/matches/:matchId/next-round', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, roundSchema);
      return c.json<RoomResponse>({
        room: await nextRoundCommand(deps, c.get('player'), code, matchId, body),
      });
    })
    .post('/:code/matches/:matchId/guess', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, guessSchema);
      return c.json<RoomResponse>({
        room: await guessCommand(deps, c.get('player'), code, matchId, body),
      });
    })
    .post('/:code/matches/:matchId/skip-guess', async (c) =>
      c.json<RoomResponse>({
        room: await skipGuessCommand(deps, c.get('player'), roomCodeParam(c), matchIdParam(c)),
      }),
    );
}
