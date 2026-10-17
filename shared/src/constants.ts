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
