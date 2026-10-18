import { AWAY_SETBACK_MS, isOnline, type RoomSnapshot } from '@family-night/shared';
import type { Deps } from '../deps.ts';
import { iso, ttlFrom } from '../lib/time.ts';
import type { PlayerItem } from '../repos/players.ts';
import {
  replaceMember,
  requireMember,
  resolveHost,
  touchMember,
  updateRoom,
} from './room-state.ts';

export function ping(deps: Deps, player: PlayerItem, roomCode: string): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, (state, nowMs) => {
    const members = replaceMember(
      state.members,
      touchMember(requireMember(state, player.playerId), nowMs),
    );
    return { hostId: resolveHost(state.room.hostId, members, nowMs), members };
  });
}

export async function markAway(deps: Deps, player: PlayerItem, roomCode: string): Promise<void> {
  await updateRoom(deps, roomCode, (state, nowMs) => {
    const member = requireMember(state, player.playerId);
    if (!isOnline(member.lastSeenAt, nowMs))
      return { hostId: state.room.hostId, members: state.members };
    const away = { ...member, lastSeenAt: iso(nowMs - AWAY_SETBACK_MS), ttl: ttlFrom(nowMs) };
    return { hostId: state.room.hostId, members: replaceMember(state.members, away) };
  });
}
