import {
  isRoomCode,
  PLAYER_ID_HEADER,
  PLAYER_TOKEN_HEADER,
  type RoomSnapshot,
  type RoundRequest,
} from '@family-night/shared';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import type { Deps } from '../deps.ts';
import { parseCredentials } from '../lib/auth.ts';
import { AppError } from '../lib/errors.ts';
import { ulidPattern } from '../lib/ulid.ts';
import type { PlayerItem } from '../repos/players.ts';
import { authenticate } from '../services/players.ts';

export interface AppEnv {
  Variables: { player: PlayerItem };
}

export type MatchRequest = (
  c: Context<AppEnv>,
  roomCode: string,
  matchId: string,
) => Promise<RoomSnapshot>;

export const roundNumber = z.int().min(1).max(99);
export const roundSchema: z.ZodType<RoundRequest> = z.object({ round: roundNumber });

export function requirePlayer(deps: Deps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const credentials = parseCredentials(
      c.req.header(PLAYER_ID_HEADER),
      c.req.header(PLAYER_TOKEN_HEADER),
    );
    c.set('player', await authenticate(deps, credentials));
    await next();
  });
}

export function roomCodeParam(c: Context<AppEnv>): string {
  const code = c.req.param('code') ?? '';
  if (!isRoomCode(code)) throw new AppError('VALIDATION_ERROR', { code: 'invalid room code' });
  return code;
}

export function matchIdParam(c: Context<AppEnv>): string {
  const matchId = c.req.param('matchId') ?? '';
  if (!ulidPattern.test(matchId)) {
    throw new AppError('VALIDATION_ERROR', { matchId: 'invalid match id' });
  }
  return matchId;
}

export async function parseBody<T>(c: Context<AppEnv>, schema: z.ZodType<T>): Promise<T> {
  const raw: unknown = await c.req.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      'VALIDATION_ERROR',
      parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return parsed.data;
}
