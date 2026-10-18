import type { GameType, RoomResponse } from '@family-night/shared';
import { Hono } from 'hono';
import type { Deps } from '../deps.ts';
import { AppError } from '../lib/errors.ts';
import { matchGameType } from '../services/matches/index.ts';
import { justOneRequests } from './justone.ts';
import { matchIdParam, roomCodeParam, type AppEnv, type MatchRequest } from './context.ts';
import { wavelengthRequests } from './wavelength.ts';

export interface SharedMatchRequests {
  clue?: MatchRequest;
  guess?: MatchRequest;
}

type SharedPath = keyof SharedMatchRequests;

export function sharedMatchRoutes(deps: Deps) {
  const games: Record<GameType, SharedMatchRequests> = {
    IMPOSTOR: {},
    WAVELENGTH: wavelengthRequests(deps),
    JUST_ONE: justOneRequests(deps),
  };
  const dispatch = (path: SharedPath) => async (c: Parameters<MatchRequest>[0]) => {
    const [code, matchId] = [roomCodeParam(c), matchIdParam(c)];
    const gameType = await matchGameType(deps, c.get('player'), code, matchId);
    const request = games[gameType][path];
    if (!request) throw new AppError('STALE_ROUND');
    return c.json<RoomResponse>({ room: await request(c, code, matchId) });
  };
  return new Hono<AppEnv>()
    .put('/:code/matches/:matchId/clue', dispatch('clue'))
    .put('/:code/matches/:matchId/guess', dispatch('guess'));
}
