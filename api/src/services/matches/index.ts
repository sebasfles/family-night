import {
  isOnline,
  type GameConfigRequest,
  type ImpostorConfig,
  type MatchSecretResponse,
  type RoomSnapshot,
} from '@family-night/shared';
import type { Deps } from '../../deps.ts';
import { AppError } from '../../lib/errors.ts';
import { iso, ttlFrom } from '../../lib/time.ts';
import { ulid } from '../../lib/ulid.ts';
import { byJoinOrder } from '../../realtime/snapshot.ts';
import type { PlayerItem } from '../../repos/players.ts';
import {
  checkImpostorStart,
  impostorDeparture,
  parseImpostorConfig,
  prepareImpostor,
} from '../impostor/index.ts';
import { updateRoom, type RoomChange, type RoomState } from '../room-state.ts';
import { applyMatchUpdate, callerChange, requireCurrentMatch } from './match-change.ts';

export interface ConfigBody {
  gameType: GameConfigRequest['gameType'];
  config: unknown;
}

function isPlaying(state: RoomState): boolean {
  return state.match?.publicState.status === 'PLAYING';
}

function createMatch(
  deps: Deps,
  state: RoomState,
  change: RoomChange,
  config: ImpostorConfig,
  nowMs: number,
): RoomChange {
  const participants = change.members
    .filter((member) => isOnline(member.lastSeenAt, nowMs))
    .toSorted(byJoinOrder)
    .map((member) => member.playerId);
  checkImpostorStart(config, participants.length);
  const matchId = ulid(nowMs);
  const prepared = prepareImpostor(deps, {
    matchId,
    config,
    participants,
    usedWordIds: state.room.usedWordIds,
    nowMs,
  });
  return {
    ...change,
    currentMatch: {
      roomCode: state.room.roomCode,
      matchId,
      publicState: prepared.publicState,
      createdAt: iso(nowMs),
      endedAt: null,
      ttl: ttlFrom(nowMs),
    },
    usedWordIds: prepared.usedWordIds,
    writes: [...(change.writes ?? []), ...prepared.writes],
  };
}

export function startMatch(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  body: ConfigBody,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, (state, nowMs) => {
    const change = callerChange(state, player.playerId, nowMs, 'host');
    if (isPlaying(state)) throw new AppError('MATCH_IN_PROGRESS');
    const config = parseImpostorConfig(body.config);
    return createMatch(
      deps,
      state,
      { ...change, configs: { ...state.room.configs, [body.gameType]: config } },
      config,
      nowMs,
    );
  });
}

export function updateConfig(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  body: ConfigBody,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, (state, nowMs) => {
    const change = callerChange(state, player.playerId, nowMs, 'host');
    const config = parseImpostorConfig(body.config);
    return { ...change, configs: { ...state.room.configs, [body.gameType]: config } };
  });
}

export function rematch(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, async (state, nowMs) => {
    const change = callerChange(state, player.playerId, nowMs, 'host');
    const match = await requireCurrentMatch(deps, state, matchId, nowMs);
    if (match.publicState.status === 'PLAYING') throw new AppError('MATCH_IN_PROGRESS');
    const config = parseImpostorConfig(match.publicState.config);
    return createMatch(deps, state, change, config, nowMs);
  });
}

export function abortMatch(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, async (state, nowMs) => {
    const change = callerChange(state, player.playerId, nowMs, 'host');
    const match = await requireCurrentMatch(deps, state, matchId, nowMs);
    if (match.publicState.status !== 'PLAYING') throw new AppError('STALE_ROUND');
    const aborted = {
      ...match,
      publicState: { ...match.publicState, status: 'ABORTED' as const },
      endedAt: iso(nowMs),
      ttl: ttlFrom(nowMs),
    };
    return {
      ...change,
      currentMatch: null,
      writes: [deps.repos.matches.putItem(aborted)],
    };
  });
}

export function backToLobby(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, (state, nowMs) => {
    const change = callerChange(state, player.playerId, nowMs, 'host');
    if (isPlaying(state)) throw new AppError('MATCH_IN_PROGRESS');
    return { ...change, currentMatch: null };
  });
}

export async function departureChange(
  deps: Deps,
  state: RoomState,
  change: RoomChange,
  playerId: string,
  reason: 'LEFT' | 'KICKED',
  nowMs: number,
): Promise<RoomChange> {
  if (!state.match) return change;
  const update = await impostorDeparture(deps, state.match, playerId, reason, nowMs);
  return update ? applyMatchUpdate(change, state.match, update, nowMs) : change;
}

export async function mySecret(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
): Promise<MatchSecretResponse> {
  const nowMs = deps.clock();
  const [member, match] = await Promise.all([
    deps.repos.roomMembers.get(roomCode, player.playerId, nowMs),
    deps.repos.matches.get(roomCode, matchId, nowMs),
  ]);
  if (!member) {
    if (!(await deps.repos.rooms.get(roomCode, nowMs))) throw new AppError('ROOM_NOT_FOUND');
    throw new AppError('NOT_MEMBER');
  }
  if (!match) throw new AppError('MATCH_NOT_FOUND');
  const item = await deps.repos.matchSecrets.getPlayer(matchId, player.playerId, nowMs);
  return { secret: item?.secret ?? null };
}
