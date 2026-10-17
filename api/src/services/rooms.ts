import { MAX_ROOM_MEMBERS, type RoomSnapshot } from '@family-night/shared';
import type { Deps } from '../deps.ts';
import { AppError } from '../lib/errors.ts';
import { iso, ttlFrom } from '../lib/time.ts';
import { buildSnapshot } from '../realtime/snapshot.ts';
import { isWriteConflict, transactWrite } from '../repos/db.ts';
import type { PlayerItem } from '../repos/players.ts';
import type { MemberItem } from '../repos/room-members.ts';
import type { RoomItem } from '../repos/rooms.ts';
import { randomRoomCode, ROOM_CODE_ATTEMPTS } from './room-code.ts';
import {
  findMember,
  replaceMember,
  requireMember,
  resolveHost,
  touchMember,
  updateRoom,
  type RoomChange,
  type RoomState,
} from './room-state.ts';

function newMember(roomCode: string, player: PlayerItem, nowMs: number): MemberItem {
  const now = iso(nowMs);
  return {
    roomCode,
    playerId: player.playerId,
    name: player.name,
    joinedAt: now,
    lastSeenAt: now,
    lastActiveAt: now,
    totalScore: 0,
    ttl: ttlFrom(nowMs),
  };
}

function touchCaller(state: RoomState, playerId: string, nowMs: number): MemberItem[] {
  return replaceMember(state.members, touchMember(requireMember(state, playerId), nowMs));
}

function hostAction(state: RoomState, callerId: string, nowMs: number): RoomChange {
  const members = touchCaller(state, callerId, nowMs);
  const hostId = resolveHost(state.room.hostId, members, nowMs);
  if (hostId !== callerId) throw new AppError('NOT_HOST');
  return { hostId, members };
}

export async function createRoom(deps: Deps, player: PlayerItem): Promise<RoomSnapshot> {
  const { client, rooms, roomMembers } = deps.repos;
  for (let attempt = 1; attempt <= ROOM_CODE_ATTEMPTS; attempt++) {
    const nowMs = deps.clock();
    const roomCode = randomRoomCode(deps.random);
    const room: RoomItem = {
      roomCode,
      hostId: player.playerId,
      version: 1,
      createdAt: iso(nowMs),
      updatedAt: iso(nowMs),
      ttl: ttlFrom(nowMs),
    };
    const member = newMember(roomCode, player, nowMs);
    try {
      await transactWrite(client, [rooms.createItem(room, nowMs), roomMembers.putItem(member)]);
    } catch (error) {
      if (isWriteConflict(error)) continue;
      throw error;
    }
    return buildSnapshot({ ...room, members: [member] }, nowMs);
  }
  throw new Error('no free room code');
}

export function getRoom(deps: Deps, player: PlayerItem, roomCode: string): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, (state, nowMs) => {
    requireMember(state, player.playerId);
    return {
      hostId: resolveHost(state.room.hostId, state.members, nowMs),
      members: state.members,
    };
  });
}

export function joinRoom(deps: Deps, player: PlayerItem, roomCode: string): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, (state, nowMs) => {
    const existing = findMember(state.members, player.playerId);
    let members: MemberItem[];
    if (existing) {
      members = replaceMember(state.members, touchMember(existing, nowMs));
    } else {
      if (state.members.length >= MAX_ROOM_MEMBERS) throw new AppError('ROOM_FULL');
      members = [...state.members, newMember(roomCode, player, nowMs)];
    }
    return { hostId: resolveHost(state.room.hostId, members, nowMs), members };
  });
}

export async function leaveRoom(deps: Deps, player: PlayerItem, roomCode: string): Promise<void> {
  await updateRoom(deps, roomCode, (state, nowMs) => {
    requireMember(state, player.playerId);
    const members = state.members.filter((member) => member.playerId !== player.playerId);
    return { hostId: resolveHost(state.room.hostId, members, nowMs), members };
  });
}

export function kickMember(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  targetId: string,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, (state, nowMs) => {
    const { hostId, members } = hostAction(state, player.playerId, nowMs);
    if (targetId === player.playerId) throw new AppError('VALIDATION_ERROR');
    if (!findMember(members, targetId)) throw new AppError('TARGET_NOT_MEMBER');
    return {
      hostId,
      members: members.filter((member) => member.playerId !== targetId),
      events: [{ type: 'member.kicked', playerId: targetId }],
    };
  });
}

export function handOverHost(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  targetId: string,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, (state, nowMs) => {
    const { members } = hostAction(state, player.playerId, nowMs);
    if (!findMember(members, targetId)) throw new AppError('TARGET_NOT_MEMBER');
    return { hostId: targetId, members };
  });
}
