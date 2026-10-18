import type { Player, RoomSnapshot } from './domain.ts';

export interface HealthResponse {
  ok: true;
  version: string;
}

export interface CreatePlayerResponse extends Player {
  playerToken: string;
}

export type MeResponse = Player;

export interface RoomResponse {
  room: RoomSnapshot;
}

export interface LeaveRoomResponse {
  ok: true;
}

export interface TargetPlayerRequest {
  playerId: string;
}

export type KickRequest = TargetPlayerRequest;
export type HandOverHostRequest = TargetPlayerRequest;

export const API_ERRORS = {
  UNAUTHORIZED: { status: 401, message: 'No pudimos reconocer este celular' },
  NOT_MEMBER: { status: 403, message: 'No estás en esta sala' },
  NOT_HOST: { status: 403, message: 'Solo el host puede hacer eso' },
  ROOM_NOT_FOUND: { status: 404, message: 'Esta sala no existe o ya expiró' },
  NOT_FOUND: { status: 404, message: 'No encontramos lo que buscas' },
  ROOM_FULL: { status: 409, message: 'La sala está llena, ya hay 20 jugadores' },
  TARGET_NOT_MEMBER: { status: 409, message: 'Esa persona ya no está en la sala' },
  CONFLICT: { status: 409, message: 'Hubo cambios al mismo tiempo, intenta de nuevo' },
  VALIDATION_ERROR: { status: 400, message: 'Los datos enviados no son válidos' },
  INTERNAL_ERROR: { status: 500, message: 'Algo salió mal, intenta de nuevo' },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof API_ERRORS;

export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}
