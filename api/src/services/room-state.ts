import { setTimeout as delay } from 'node:timers/promises';
import { HOST_SILENCE_MS, isOnline, type RoomEvent, type RoomSnapshot } from '@family-night/shared';
import type { Deps } from '../deps.ts';
import { AppError } from '../lib/errors.ts';
import { iso, ttlFrom } from '../lib/time.ts';
import { buildSnapshot, byJoinOrder, publicMember } from '../realtime/snapshot.ts';
import { isWriteConflict, transactWrite } from '../repos/db.ts';
import type { MemberItem } from '../repos/room-members.ts';
import type { RoomItem } from '../repos/rooms.ts';

export const MAX_WRITE_ATTEMPTS = 4;

export interface RoomState {
  room: RoomItem;
  members: MemberItem[];
}

export interface RoomChange {
  hostId: string;
  members: MemberItem[];
  events?: RoomEvent[];
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
  return { room, members };
}

async function commit(
  deps: Deps,
  state: RoomState,
  change: RoomChange,
  bump: boolean,
  nowMs: number,
): Promise<void> {
  const { client, rooms, roomMembers } = deps.repos;
  const changed = change.members.filter((member) => !state.members.includes(member));
  const ttl = ttlFrom(nowMs);

  if (bump) {
    const removed = state.members.filter((member) => !findMember(change.members, member.playerId));
    await transactWrite(client, [
      rooms.bumpItem({
        roomCode: state.room.roomCode,
        expectedVersion: state.room.version,
        hostId: change.hostId,
        updatedAt: iso(nowMs),
        ttl,
      }),
      ...changed.map((member) => roomMembers.putItem(member)),
      ...removed.map((member) => roomMembers.deleteItem(member.roomCode, member.playerId)),
    ]);
    return;
  }

  if (changed.length === 0) return;
  for (const member of changed) await roomMembers.updatePresence(member);
  await rooms.renewTtl(state.room.roomCode, ttl);
}

export async function updateRoom(
  deps: Deps,
  roomCode: string,
  decide: (state: RoomState, nowMs: number) => RoomChange,
): Promise<RoomSnapshot> {
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    const nowMs = deps.clock();
    const state = await loadRoom(deps, roomCode, nowMs);
    const change = decide(state, nowMs);
    const bump = changesSnapshot(state, change, nowMs);
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
