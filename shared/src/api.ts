import type { GameType, ImpostorConfig, ImpostorSecret, Player, RoomSnapshot } from './domain.ts';

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

export interface GameConfigRequest {
  gameType: GameType;
  config: ImpostorConfig;
}

export type StartMatchRequest = GameConfigRequest;
export type UpdateConfigRequest = GameConfigRequest;

export interface MatchSecretResponse {
  secret: ImpostorSecret | null;
}

export interface RoundRequest {
  round: number;
}

export type CloseVotingRequest = RoundRequest;
export type NextRoundRequest = RoundRequest;

export interface VoteRequest extends RoundRequest {
  targetId: string;
}

export interface GuessRequest {
  option: string;
}

export interface WordCategory {
  id: string;
  name: string;
  count: number;
}

export interface WordCategoriesResponse {
  categories: WordCategory[];
}

export const API_ERRORS = {
  UNAUTHORIZED: { status: 401, message: 'No pudimos reconocer este celular' },
  NOT_MEMBER: { status: 403, message: 'No estás en esta sala' },
  NOT_HOST: { status: 403, message: 'Solo el host puede hacer eso' },
  ROOM_NOT_FOUND: { status: 404, message: 'Esta sala no existe o ya expiró' },
  NOT_FOUND: { status: 404, message: 'No encontramos lo que buscas' },
  ROOM_FULL: { status: 409, message: 'La sala está llena, ya hay 20 jugadores' },
  TARGET_NOT_MEMBER: { status: 409, message: 'Esa persona ya no está en la sala' },
  MATCH_NOT_FOUND: { status: 404, message: 'Esta partida no existe' },
  NOT_GUESSER: { status: 403, message: 'Solo el impostor atrapado puede adivinar' },
  MATCH_IN_PROGRESS: { status: 409, message: 'Ya hay una partida en curso' },
  STALE_ROUND: { status: 409, message: 'Esa ronda ya terminó' },
  NOT_ENOUGH_PLAYERS: { status: 422, message: 'Se necesitan al menos 3 jugadores en línea' },
  INVALID_CONFIG: { status: 422, message: 'La configuración de la partida no es válida' },
  INVALID_VOTE: { status: 422, message: 'Ese voto no es válido' },
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
