import {
  isOnline,
  type GameConfigs,
  type GameType,
  type MatchSecretResponse,
  type RoomSnapshot,
  type RoundRequest,
} from '@family-night/shared';
import type { Deps } from '../../deps.ts';
import { AppError } from '../../lib/errors.ts';
import { iso, ttlFrom } from '../../lib/time.ts';
import { ulid } from '../../lib/ulid.ts';
import { byJoinOrder } from '../../realtime/snapshot.ts';
import type { MatchItem } from '../../repos/matches.ts';
import type { PlayerItem } from '../../repos/players.ts';
import { gameOf, type DepartureReason } from '../games.ts';
import { updateRoom, type RoomChange, type RoomState } from '../room-state.ts';
import {
  applyMatchUpdate,
  callerChange,
  matchCommand,
  requireCurrentMatch,
} from './match-change.ts';

export interface ConfigBody {
  gameType: GameType;
  config: unknown;
}

type GameConfig = GameConfigs[GameType];

function isPlaying(state: RoomState): boolean {
  return state.match?.publicState.status === 'PLAYING';
}

function withConfig(
  configs: Partial<GameConfigs>,
  gameType: GameType,
  config: GameConfig,
): Partial<GameConfigs> {
  return { ...configs, [gameType]: config };
}

function createMatch(
  deps: Deps,
  state: RoomState,
  change: RoomChange,
  gameType: GameType,
  config: GameConfig,
  nowMs: number,
): RoomChange {
  const game = gameOf(gameType);
  const participants = change.members
    .filter((member) => isOnline(member.lastSeenAt, nowMs))
    .toSorted(byJoinOrder)
    .map((member) => member.playerId);
  game.checkStart(config, participants.length);
  const matchId = ulid(nowMs);
  const prepared = game.prepare(deps, {
    matchId,
    config,
    participants,
    room: state.room,
    nowMs,
  });
  return {
    ...change,
    selectedGame: gameType,
    currentMatch: {
      roomCode: state.room.roomCode,
      matchId,
      publicState: prepared.publicState,
      createdAt: iso(nowMs),
      endedAt: null,
      ttl: ttlFrom(nowMs),
    },
    ...(prepared.usedWordIds ? { usedWordIds: prepared.usedWordIds } : {}),
    ...(prepared.usedSpectrumIds ? { usedSpectrumIds: prepared.usedSpectrumIds } : {}),
    ...(prepared.usedJustOneWordIds ? { usedJustOneWordIds: prepared.usedJustOneWordIds } : {}),
    ...(prepared.usedManadaQuestionIds
      ? { usedManadaQuestionIds: prepared.usedManadaQuestionIds }
      : {}),
    writes: [...(change.writes ?? []), ...(prepared.writes ?? [])],
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
    const config = gameOf(body.gameType).parseConfig(body.config);
    return createMatch(
      deps,
      state,
      { ...change, configs: withConfig(state.room.configs, body.gameType, config) },
      body.gameType,
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
    const config = gameOf(body.gameType).parseConfig(body.config);
    return {
      ...change,
      selectedGame: body.gameType,
      configs: withConfig(state.room.configs, body.gameType, config),
    };
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
    const { gameType } = match.publicState;
    const config = gameOf(gameType).parseConfig(match.publicState.config);
    return createMatch(deps, state, change, gameType, config, nowMs);
  });
}

export function nextRound(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', (match, nowMs, state) =>
    gameOf(match.publicState.gameType).nextRound(deps, match, round, state.room, nowMs),
  );
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
  reason: DepartureReason,
  nowMs: number,
): Promise<RoomChange> {
  const { match } = state;
  if (!match) return change;
  const game = gameOf(match.publicState.gameType);
  const update = await game.departure(deps, match, playerId, reason, state.room, nowMs);
  return update ? applyMatchUpdate(change, match, update, nowMs) : change;
}

async function memberMatch(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  nowMs: number,
): Promise<MatchItem> {
  const [member, match] = await Promise.all([
    deps.repos.roomMembers.get(roomCode, player.playerId, nowMs),
    deps.repos.matches.get(roomCode, matchId, nowMs),
  ]);
  if (!member) {
    if (!(await deps.repos.rooms.get(roomCode, nowMs))) throw new AppError('ROOM_NOT_FOUND');
    throw new AppError('NOT_MEMBER');
  }
  if (!match) throw new AppError('MATCH_NOT_FOUND');
  return match;
}

export async function matchGameType(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
): Promise<GameType> {
  const match = await memberMatch(deps, player, roomCode, matchId, deps.clock());
  return match.publicState.gameType;
}

export async function mySecret(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
): Promise<MatchSecretResponse> {
  const nowMs = deps.clock();
  const match = await memberMatch(deps, player, roomCode, matchId, nowMs);
  const game = gameOf(match.publicState.gameType);
  return { secret: await game.secret(deps, match, player.playerId, nowMs) };
}
