import { setTimeout as delay } from 'node:timers/promises';
import {
  HOST_SILENCE_MS,
  isOnline,
  type GameConfigs,
  type GameType,
  type RoomEvent,
  type RoomSnapshot,
} from '@family-night/shared';
import type { Deps } from '../deps.ts';
import { AppError } from '../lib/errors.ts';
import { iso, ttlFrom } from '../lib/time.ts';
import { buildSnapshot, byJoinOrder, publicMember } from '../realtime/snapshot.ts';
import { isWriteConflict, transactWrite, type TransactItem } from '../repos/db.ts';
import type { MatchItem } from '../repos/matches.ts';
import type { MemberItem } from '../repos/room-members.ts';
import type { RoomItem } from '../repos/rooms.ts';
import { resolveConfigs } from './games.ts';

export const MAX_WRITE_ATTEMPTS = 4;

export interface RoomState {
  room: RoomItem;
  members: MemberItem[];
  match: MatchItem | null;
}

export interface RoomChange {
  hostId: string;
  members: MemberItem[];
  events?: RoomEvent[];
  currentMatch?: MatchItem | null;
  configs?: Partial<GameConfigs>;
  selectedGame?: GameType;
  usedWordIds?: string[];
  usedSpectrumIds?: string[];
  usedJustOneWordIds?: string[];
  writes?: TransactItem[];
}

export type Decide = (state: RoomState, nowMs: number) => RoomChange | Promise<RoomChange>;

function currentMatchAfter(state: RoomState, change: RoomChange): MatchItem | null {
  return change.currentMatch === undefined ? state.match : change.currentMatch;
}

export function findMember(members: MemberItem[], playerId: string): MemberItem | undefined {
  return members.find((member) => member.playerId === playerId);
}

export function requireMember(state: RoomState, playerId: string): MemberItem {
  const member = findMember(state.members, playerId);
  if (!member) throw new AppError('NOT_MEMBER');
  return member;
}

export function replaceMember(members: MemberItem[], next: MemberItem): MemberItem[] {
  return members.map((member) => (member.playerId === next.playerId ? next : member));
}

export function touchMember(member: MemberItem, nowMs: number): MemberItem {
  const now = iso(nowMs);
  return { ...member, lastSeenAt: now, lastActiveAt: now, ttl: ttlFrom(nowMs) };
}

export function resolveHost(hostId: string, members: MemberItem[], nowMs: number): string {
  const host = findMember(members, hostId);
  if (host && nowMs - Date.parse(host.lastActiveAt) <= HOST_SILENCE_MS) return hostId;
  const byAge = members.toSorted(byJoinOrder);
  const online = byAge.filter(
    (member) => member.playerId !== hostId && isOnline(member.lastSeenAt, nowMs),
  );
  if (online[0]) return online[0].playerId;
  if (!host && byAge[0]) return byAge[0].playerId;
  return hostId;
}

export function changesSnapshot(before: RoomState, after: RoomChange, nowMs: number): boolean {
  if (before.room.hostId !== after.hostId) return true;
  const matchBefore = JSON.stringify(before.match?.publicState ?? null);
  const matchAfter = JSON.stringify(currentMatchAfter(before, after)?.publicState ?? null);
  if (matchBefore !== matchAfter) return true;
  if (after.configs && JSON.stringify(after.configs) !== JSON.stringify(before.room.configs)) {
    return true;
  }
  if (after.selectedGame && after.selectedGame !== before.room.selectedGame) return true;
  const project = (members: MemberItem[]) =>
    JSON.stringify(
      members
        .toSorted(byJoinOrder)
        .map((member) => ({ ...publicMember(member, nowMs), lastSeenAt: undefined })),
    );
  return project(before.members) !== project(after.members);
}

async function loadRoom(deps: Deps, roomCode: string, nowMs: number): Promise<RoomState> {
  const room = await deps.repos.rooms.get(roomCode, nowMs);
  if (!room) throw new AppError('ROOM_NOT_FOUND');
  const members = await deps.repos.roomMembers.list(roomCode, nowMs);
  const match = room.currentMatchId
    ? await deps.repos.matches.get(roomCode, room.currentMatchId, nowMs)
    : null;
  return { room, members, match };
}

async function commit(
  deps: Deps,
  state: RoomState,
  change: RoomChange,
  bump: boolean,
  nowMs: number,
): Promise<void> {
  const { client, rooms, roomMembers, matches } = deps.repos;
  const changed = change.members.filter((member) => !state.members.includes(member));
  const current = currentMatchAfter(state, change);
  const ttl = ttlFrom(nowMs);

  if (bump) {
    const removed = state.members.filter((member) => !findMember(change.members, member.playerId));
    const matchWrite = current
      ? change.currentMatch
        ? matches.putItem({ ...current, ttl })
        : matches.renewTtlItem(current.roomCode, current.matchId, ttl)
      : null;
    await transactWrite(client, [
      rooms.bumpItem({
        roomCode: state.room.roomCode,
        expectedVersion: state.room.version,
        hostId: change.hostId,
        currentMatchId: current?.matchId ?? null,
        usedWordIds: change.usedWordIds ?? state.room.usedWordIds,
        usedSpectrumIds: change.usedSpectrumIds ?? state.room.usedSpectrumIds,
        usedJustOneWordIds: change.usedJustOneWordIds ?? state.room.usedJustOneWordIds,
        selectedGame: change.selectedGame ?? state.room.selectedGame,
        configs: change.configs ?? state.room.configs,
        updatedAt: iso(nowMs),
        ttl,
      }),
      ...(matchWrite ? [matchWrite] : []),
      ...(change.writes ?? []),
      ...changed.map((member) => roomMembers.putItem(member)),
      ...removed.map((member) => roomMembers.deleteItem(member.roomCode, member.playerId)),
    ]);
    return;
  }

  if (changed.length === 0) return;
  for (const member of changed) await roomMembers.updatePresence(member);
  await rooms.renewTtl(state.room.roomCode, ttl);
  if (current) await matches.renewTtl(current.roomCode, current.matchId, ttl);
}

export async function updateRoom(
  deps: Deps,
  roomCode: string,
  decide: Decide,
): Promise<RoomSnapshot> {
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    const nowMs = deps.clock();
    const state = await loadRoom(deps, roomCode, nowMs);
    const change = await decide(state, nowMs);
    const bump = changesSnapshot(state, change, nowMs) || (change.writes?.length ?? 0) > 0;
    try {
      await commit(deps, state, change, bump, nowMs);
    } catch (error) {
      if (!isWriteConflict(error)) throw error;
      await delay(Math.random() * 25 * attempt);
      continue;
    }
    const snapshot = buildSnapshot(
      {
        roomCode,
        version: bump ? state.room.version + 1 : state.room.version,
        hostId: change.hostId,
        members: change.members,
        currentMatch: currentMatchAfter(state, change)?.publicState ?? null,
        selectedGame: change.selectedGame ?? state.room.selectedGame,
        configs: resolveConfigs(change.configs ?? state.room.configs),
      },
      nowMs,
    );
    if (bump) {
      await deps.publish(roomCode, [
        ...(change.events ?? []),
        { type: 'room.updated', room: snapshot },
      ]);
    }
    return snapshot;
  }
  throw new AppError('CONFLICT');
}
