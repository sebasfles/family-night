import { ROOM_TTL_SECONDS } from '@family-night/shared';

export type Clock = () => number;

export function iso(ms: number): string {
  return new Date(ms).toISOString();
}

export function epochSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

export function ttlFrom(nowMs: number): number {
  return epochSeconds(nowMs) + ROOM_TTL_SECONDS;
}
