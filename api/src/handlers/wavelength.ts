import {
  DIAL_MAX,
  WAVELENGTH_CLUE_MAX,
  type ClueRequest,
  type DialGuessRequest,
  type RoomResponse,
} from '@family-night/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import {
  clueCommand,
  closeGuessingCommand,
  commitGuess,
  skipPsychicCommand,
} from '../services/wavelength/index.ts';
import { matchIdParam, parseBody, roomCodeParam, type AppEnv } from './context.ts';
import { roundSchema } from './matches.ts';

const round = z.int().min(1).max(99);
const clueSchema: z.ZodType<ClueRequest> = z.object({
  round,
  clue: z.string().trim().min(1).max(WAVELENGTH_CLUE_MAX),
});
const guessSchema: z.ZodType<DialGuessRequest> = z.object({
  round,
  value: z.int().min(0).max(DIAL_MAX),
});

export function wavelengthRoutes(deps: Deps) {
  return new Hono<AppEnv>()
    .put('/:code/matches/:matchId/clue', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, clueSchema);
      return c.json<RoomResponse>({
        room: await clueCommand(deps, c.get('player'), code, matchId, body),
      });
    })
    .put('/:code/matches/:matchId/guess', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, guessSchema);
      return c.json<RoomResponse>({
        room: await commitGuess(deps, c.get('player'), code, matchId, body),
      });
    })
    .post('/:code/matches/:matchId/close-guessing', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, roundSchema);
      return c.json<RoomResponse>({
        room: await closeGuessingCommand(deps, c.get('player'), code, matchId, body),
      });
    })
    .post('/:code/matches/:matchId/skip-psychic', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, roundSchema);
      return c.json<RoomResponse>({
        room: await skipPsychicCommand(deps, c.get('player'), code, matchId, body),
      });
    });
}
