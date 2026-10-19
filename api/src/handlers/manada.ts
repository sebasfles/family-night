import {
  cleanAnswer,
  isManadaAnswer,
  MANADA_ANSWER_MAX,
  type ManadaAnswerRequest,
  type MergeGroupsRequest,
  type RoomResponse,
  type RoomSnapshot,
  type SplitGroupRequest,
} from '@family-night/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { playerIdSchema } from '../lib/auth.ts';
import type { PlayerItem } from '../repos/players.ts';
import {
  closeAnswersCommand,
  commitAnswer,
  mergeGroupsCommand,
  splitGroupCommand,
} from '../services/manada/index.ts';
import {
  matchIdParam,
  parseBody,
  roomCodeParam,
  roundNumber,
  roundSchema,
  type AppEnv,
  type MatchRequest,
} from './context.ts';

const answerSchema: z.ZodType<ManadaAnswerRequest> = z.object({
  round: roundNumber,
  answer: z
    .string()
    .max(MANADA_ANSWER_MAX * 4)
    .refine(isManadaAnswer)
    .transform(cleanAnswer),
});
const mergeSchema: z.ZodType<MergeGroupsRequest> = z.object({
  round: roundNumber,
  groupIds: z.tuple([playerIdSchema, playerIdSchema]),
});
const splitSchema: z.ZodType<SplitGroupRequest> = z.object({
  round: roundNumber,
  groupId: playerIdSchema,
});

type Command<T> = (
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  body: T,
) => Promise<RoomSnapshot>;

export function manadaRoutes(deps: Deps) {
  const route =
    <T>(schema: z.ZodType<T>, command: Command<T>) =>
    async (c: Parameters<MatchRequest>[0]) => {
      const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
      const body = await parseBody(c, schema);
      return c.json<RoomResponse>({
        room: await command(deps, c.get('player'), code, matchId, body),
      });
    };
  return new Hono<AppEnv>()
    .put('/:code/matches/:matchId/answer', route(answerSchema, commitAnswer))
    .post('/:code/matches/:matchId/close-answers', route(roundSchema, closeAnswersCommand))
    .post('/:code/matches/:matchId/merge-groups', route(mergeSchema, mergeGroupsCommand))
    .post('/:code/matches/:matchId/split-group', route(splitSchema, splitGroupCommand));
}
