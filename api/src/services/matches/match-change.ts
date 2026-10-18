import type { MatchPublic } from '@family-night/shared';
import type { Deps } from '../../deps.ts';
import { AppError } from '../../lib/errors.ts';
import { iso } from '../../lib/time.ts';
import type { TransactItem } from '../../repos/db.ts';
import type { MatchItem } from '../../repos/matches.ts';
import type { MemberItem } from '../../repos/room-members.ts';
import {
  replaceMember,
  requireMember,
  resolveHost,
  touchMember,
  type RoomChange,
  type RoomState,
} from '../room-state.ts';

export interface MatchUpdate {
  publicState: MatchPublic;
  writes?: TransactItem[];
  scores?: Record<string, number>;
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
  };
}
