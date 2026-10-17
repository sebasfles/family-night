import type { RoomSnapshot } from './domain.ts';

export type RoomEvent =
  | { type: 'room.updated'; room: RoomSnapshot }
  | { type: 'member.kicked'; playerId: string }
  | { type: 'room.closed' };
