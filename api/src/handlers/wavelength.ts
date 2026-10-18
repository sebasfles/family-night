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
import {
  matchIdParam,
  parseBody,
  roomCodeParam,
  roundNumber,
  roundSchema,
  type AppEnv,
  type MatchRequest,
} from './context.ts';
import type { SharedMatchRequests } from './shared-match.ts';

const clueSchema: z.ZodType<ClueRequest> = z.object({
  round: roundNumber,
  clue: z.string().trim().min(1).max(WAVELENGTH_CLUE_MAX),
});
const guessSchema: z.ZodType<DialGuessRequest> = z.object({
  round: roundNumber,
  value: z.int().min(0).max(DIAL_MAX),
});

export function wavelengthRequests(deps: Deps): SharedMatchRequests {
  const clue: MatchRequest = async (c, code, matchId) =>
    clueCommand(deps, c.get('player'), code, matchId, await parseBody(c, clueSchema));
  const guess: MatchRequest = async (c, code, matchId) =>
    commitGuess(deps, c.get('player'), code, matchId, await parseBody(c, guessSchema));
  return { clue, guess };
}

export function wavelengthRoutes(deps: Deps) {
  return new Hono<AppEnv>()
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
