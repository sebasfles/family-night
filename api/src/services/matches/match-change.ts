import type { GameType, MatchPublic, RoomSnapshot } from '@family-night/shared';
import type { Deps } from '../../deps.ts';
import { AppError } from '../../lib/errors.ts';
import { iso } from '../../lib/time.ts';
import type { TransactItem } from '../../repos/db.ts';
import type { MatchItem } from '../../repos/matches.ts';
import type { PlayerItem } from '../../repos/players.ts';
import type { MemberItem } from '../../repos/room-members.ts';
import {
  replaceMember,
  requireMember,
  resolveHost,
  touchMember,
  updateRoom,
  type RoomChange,
  type RoomState,
} from '../room-state.ts';

export interface MatchUpdate {
  publicState: MatchPublic;
  writes?: TransactItem[];
  scores?: Record<string, number>;
  usedWordIds?: string[];
  usedSpectrumIds?: string[];
  usedJustOneWordIds?: string[];
}

export type GameState<G extends GameType> = Extract<MatchPublic, { gameType: G }>;

export function gameState<G extends GameType>(match: MatchItem, gameType: G): GameState<G> {
  const state = match.publicState;
  if (state.gameType !== gameType) throw new AppError('STALE_ROUND');
  return state as GameState<G>;
}

export function callerChange(
  state: RoomState,
  callerId: string,
  nowMs: number,
  role: 'member' | 'host',
): RoomChange {
  const members = replaceMember(state.members, touchMember(requireMember(state, callerId), nowMs));
  const hostId = resolveHost(state.room.hostId, members, nowMs);
  if (role === 'host' && hostId !== callerId) throw new AppError('NOT_HOST');
  return { hostId, members };
}

export async function requireCurrentMatch(
  deps: Deps,
  state: RoomState,
  matchId: string,
  nowMs: number,
): Promise<MatchItem> {
  if (state.match?.matchId === matchId) return state.match;
  const other = await deps.repos.matches.get(state.room.roomCode, matchId, nowMs);
  throw new AppError(other ? 'STALE_ROUND' : 'MATCH_NOT_FOUND');
}

function addScores(members: MemberItem[], scores: Record<string, number>): MemberItem[] {
  return members.map((member) => {
    const points = scores[member.playerId] ?? 0;
    return points ? { ...member, totalScore: member.totalScore + points } : member;
  });
}

export function applyMatchUpdate(
  change: RoomChange,
  match: MatchItem,
  update: MatchUpdate,
  nowMs: number,
): RoomChange {
  const ended = match.publicState.status === 'PLAYING' && update.publicState.status !== 'PLAYING';
  return {
    ...change,
    members: update.scores ? addScores(change.members, update.scores) : change.members,
    currentMatch: {
      ...match,
      publicState: update.publicState,
      endedAt: ended ? iso(nowMs) : match.endedAt,
    },
    writes: [...(change.writes ?? []), ...(update.writes ?? [])],
    ...(update.usedWordIds ? { usedWordIds: update.usedWordIds } : {}),
    ...(update.usedSpectrumIds ? { usedSpectrumIds: update.usedSpectrumIds } : {}),
    ...(update.usedJustOneWordIds ? { usedJustOneWordIds: update.usedJustOneWordIds } : {}),
  };
}

export type MatchAction = (
  match: MatchItem,
  nowMs: number,
  state: RoomState,
) => Promise<MatchUpdate>;

export function matchCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  role: 'member' | 'host',
  act: MatchAction,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, async (state, nowMs) => {
    const change = callerChange(state, player.playerId, nowMs, role);
    const match = await requireCurrentMatch(deps, state, matchId, nowMs);
    return applyMatchUpdate(change, match, await act(match, nowMs, state), nowMs);
  });
}
