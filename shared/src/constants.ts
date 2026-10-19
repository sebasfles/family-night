export const SITE_URL = 'https://family-night.fless.dev';

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const ROOM_CODE_LENGTH = 4;
export const MAX_ROOM_MEMBERS = 20;
export const ROOM_TTL_SECONDS = 24 * 60 * 60;

export const PING_INTERVAL_MS = 20_000;
export const ONLINE_WINDOW_MS = 45_000;
export const HOST_SILENCE_MS = 60_000;
export const AWAY_SETBACK_MS = 60_000;
export const PRESENCE_RECOMPUTE_MS = 5_000;

export const PLAYER_ID_HEADER = 'x-player-id';
export const PLAYER_TOKEN_HEADER = 'x-player-token';

export const EVENTS_NAMESPACE = 'rooms';

export const PLAYER_NAME_MIN = 2;
export const PLAYER_NAME_MAX = 20;

export const MIN_IMPOSTOR_PLAYERS = 3;
export const IMPOSTOR_CAPS = [
  { minPlayers: 9, maxImpostors: 3 },
  { minPlayers: 6, maxImpostors: 2 },
  { minPlayers: 3, maxImpostors: 1 },
] as const;
export const CIVILIAN_WIN_POINTS = 1;
export const IMPOSTOR_DEFAULTS = {
  impostorCount: 1,
  randomOrder: true,
  tieRule: 'RANDOM',
  showCategoryToImpostor: false,
} as const;

export const MIN_WAVELENGTH_PLAYERS = 2;
export const MIN_WAVELENGTH_ACTIVE = 2;
export const WAVELENGTH_UNSCORED_PLAYERS = 2;
export const WAVELENGTH_MAX_CYCLES = 3;
export const WAVELENGTH_CLUE_MAX = 40;
export const DIAL_MAX = 100;
export const DIAL_BANDS = [
  { within: 2, points: 4 },
  { within: 7, points: 3 },
  { within: 12, points: 2 },
] as const;
export const WAVELENGTH_DEFAULTS = { cycles: 1 } as const;

export const MIN_JUST_ONE_PLAYERS = 4;
export const MIN_JUST_ONE_ACTIVE = 2;
export const JUST_ONE_MAX_CYCLES = 3;
export const JUST_ONE_CLUE_MAX = 30;
export const JUST_ONE_GUESS_MAX = 30;
export const JUST_ONE_DEFAULTS = { cycles: 1 } as const;

export const MIN_MANADA_PLAYERS = 3;
export const MIN_MANADA_ACTIVE = 2;
export const MANADA_MIN_ROUNDS = 5;
export const MANADA_MAX_ROUNDS = 15;
export const MANADA_ROUND_LIMIT = 99;
export const MANADA_WIN_POINTS = 8;
export const MANADA_ANSWER_MAX = 30;
export const MANADA_ANSWER_MAX_WORDS = 3;
export const MANADA_DEFAULTS = { goal: 'ROUNDS', rounds: 10 } as const;

const roomCodePattern = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${String(ROOM_CODE_LENGTH)}}$`);

export function isRoomCode(value: string): boolean {
  return roomCodePattern.test(value);
}

export function normalizeRoomCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return isRoomCode(code) ? code : null;
}

export function roomChannel(roomCode: string): string {
  return `/${EVENTS_NAMESPACE}/${roomCode}`;
}

export function roomUrl(origin: string, roomCode: string): string {
  return `${origin}/${roomCode}`;
}

export function isOnline(lastSeenAt: string, nowMs: number): boolean {
  return nowMs - Date.parse(lastSeenAt) < ONLINE_WINDOW_MS;
}
