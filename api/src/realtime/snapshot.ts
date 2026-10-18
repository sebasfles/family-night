import {
  isOnline,
  type GameConfigs,
  type GameType,
  type MatchPublic,
  type RoomMember,
  type RoomSnapshot,
} from '@family-night/shared';
import { iso } from '../lib/time.ts';
import type { MemberItem } from '../repos/room-members.ts';

export interface SnapshotSource {
  roomCode: string;
  version: number;
  hostId: string;
  members: MemberItem[];
  currentMatch: MatchPublic | null;
  selectedGame: GameType;
  configs: GameConfigs;
}

export function byJoinOrder(a: MemberItem, b: MemberItem): number {
  return a.joinedAt.localeCompare(b.joinedAt) || a.playerId.localeCompare(b.playerId);
}

export function publicMember(member: MemberItem, nowMs: number): RoomMember {
  return {
    playerId: member.playerId,
    name: member.name,
    online: isOnline(member.lastSeenAt, nowMs),
    lastSeenAt: member.lastSeenAt,
    totalScore: member.totalScore,
    joinedAt: member.joinedAt,
  };
}

export function buildSnapshot(source: SnapshotSource, nowMs: number): RoomSnapshot {
  return {
    roomCode: source.roomCode,
    version: source.version,
    hostId: source.hostId,
    members: source.members.toSorted(byJoinOrder).map((member) => publicMember(member, nowMs)),
    currentMatch: source.currentMatch,
    selectedGame: source.selectedGame,
    configs: source.configs,
    serverTime: iso(nowMs),
  };
}
