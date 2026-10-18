import type { GameConfigs, GameType, MatchSecret, Player, RoomSnapshot } from './domain.ts';

export interface HealthResponse {
  ok: true;
  version: string;
}

export interface CreatePlayerResponse extends Player {
  playerToken: string;
}

export type MeResponse = Player;

export interface RenamePlayerRequest {
  name: string;
  roomCode: string;
}

export interface RoomResponse {
  room: RoomSnapshot;
}

export interface RenamePlayerResponse extends RoomResponse {
  player: Player;
}

export interface LeaveRoomResponse {
  ok: true;
}

export interface TargetPlayerRequest {
  playerId: string;
}

export type KickRequest = TargetPlayerRequest;
export type HandOverHostRequest = TargetPlayerRequest;

export type GameConfigRequest = {
  [G in GameType]: { gameType: G; config: GameConfigs[G] };
}[GameType];

export type StartMatchRequest = GameConfigRequest;
export type UpdateConfigRequest = GameConfigRequest;

export interface MatchSecretResponse {
  secret: MatchSecret | null;
}

export interface RoundRequest {
  round: number;
}

export type CloseVotingRequest = RoundRequest;
export type NextRoundRequest = RoundRequest;

export interface VoteRequest extends RoundRequest {
  targetId: string;
  confirmed: boolean;
}

export interface ClueRequest extends RoundRequest {
  clue: string;
}

export interface DialGuessRequest extends RoundRequest {
  value: number;
}

export type CloseGuessingRequest = RoundRequest;
export type SkipPsychicRequest = RoundRequest;

export interface JustOneClueRequest extends RoundRequest {
  clue: string;
}

export interface CancelClueRequest extends RoundRequest {
  authorId: string;
  cancelled: boolean;
}

export interface JustOneGuessRequest extends RoundRequest {
  guess: string | null;
}

export type CloseCluesRequest = RoundRequest;
export type ShowCluesRequest = RoundRequest;
export type AcceptGuessRequest = RoundRequest;
export type SkipGuesserRequest = RoundRequest;

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
  NOT_PSYCHIC: { status: 403, message: 'Solo el psíquico puede dar la pista' },
  NOT_CLUE_GIVER: { status: 403, message: 'En esta ronda no te toca dar pista' },
  MATCH_IN_PROGRESS: { status: 409, message: 'Ya hay una partida en curso' },
  STALE_ROUND: { status: 409, message: 'Esa ronda ya terminó' },
  NOT_ENOUGH_PLAYERS: { status: 422, message: 'Se necesitan al menos 3 jugadores en línea' },
  INVALID_CONFIG: { status: 422, message: 'La configuración de la partida no es válida' },
  INVALID_VOTE: { status: 422, message: 'Ese voto no es válido' },
  VOTE_CONFIRMED: { status: 409, message: 'Ya confirmaste tu voto' },
  NAME_TAKEN: { status: 409, message: 'Ese nombre ya lo tiene otra persona' },
  INVALID_NAME: { status: 422, message: 'El nombre debe tener entre 2 y 20 caracteres' },
  INVALID_GUESS: { status: 422, message: 'En esta ronda no te toca adivinar' },
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
