export interface Player {
  playerId: string;
  name: string;
}

export interface RoomMember {
  playerId: string;
  name: string;
  online: boolean;
  lastSeenAt: string;
  totalScore: number;
  joinedAt: string;
}

export interface RoomSnapshot {
  roomCode: string;
  version: number;
  hostId: string;
  members: RoomMember[];
  currentMatch: null;
  serverTime: string;
}
