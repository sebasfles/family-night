import {
  JUST_ONE_CLUE_MAX,
  JUST_ONE_GUESS_MAX,
  normalizeWord,
  type CancelClueRequest,
  type JustOneClueRequest,
  type JustOneGuessRequest,
  type RoomResponse,
  type RoomSnapshot,
  type RoundRequest,
} from '@family-night/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { playerIdSchema } from '../lib/auth.ts';
import type { PlayerItem } from '../repos/players.ts';
import {
  acceptGuessCommand,
  cancelClueCommand,
  closeCluesCommand,
  commitClue,
  guessCommand,
  showCluesCommand,
  skipGuesserCommand,
} from '../services/justone/index.ts';
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

const clueSchema: z.ZodType<JustOneClueRequest> = z.object({
  round: roundNumber,
  clue: z
    .string()
    .trim()
    .min(1)
    .max(JUST_ONE_CLUE_MAX)
    .regex(/^\S+$/u)
    .refine((clue) => normalizeWord(clue).length > 0),
});
const guessSchema: z.ZodType<JustOneGuessRequest> = z.object({
  round: roundNumber,
  guess: z.string().trim().min(1).max(JUST_ONE_GUESS_MAX).nullable(),
});
const cancelSchema: z.ZodType<CancelClueRequest> = z.object({
  round: roundNumber,
  authorId: playerIdSchema,
  cancelled: z.boolean(),
});

type RoundCommand = (
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  body: RoundRequest,
) => Promise<RoomSnapshot>;

export function justOneRequests(deps: Deps): SharedMatchRequests {
  const clue: MatchRequest = async (c, code, matchId) =>
    commitClue(deps, c.get('player'), code, matchId, await parseBody(c, clueSchema));
  const guess: MatchRequest = async (c, code, matchId) =>
    guessCommand(deps, c.get('player'), code, matchId, await parseBody(c, guessSchema));
  return { clue, guess };
}

export function justOneRoutes(deps: Deps) {
  const roundRoute = (command: RoundCommand) => async (c: Parameters<MatchRequest>[0]) => {
    const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
    const body = await parseBody(c, roundSchema);
    return c.json<RoomResponse>({
      room: await command(deps, c.get('player'), code, matchId, body),
    });
  };
  return new Hono<AppEnv>()
    .post('/:code/matches/:matchId/close-clues', roundRoute(closeCluesCommand))
    .put('/:code/matches/:matchId/cancel-clue', async (c) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, cancelSchema);
      return c.json<RoomResponse>({
        room: await cancelClueCommand(deps, c.get('player'), code, matchId, body),
      });
    })
    .post('/:code/matches/:matchId/show-clues', roundRoute(showCluesCommand))
    .post('/:code/matches/:matchId/accept-guess', roundRoute(acceptGuessCommand))
    .post('/:code/matches/:matchId/skip-guesser', roundRoute(skipGuesserCommand));
}
