import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const playerIdSchema = z.uuid();

export function newPlayerToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenMatches(token: string, storedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface Credentials {
  playerId: string;
  playerToken: string;
}

export function parseCredentials(
  playerId: string | undefined,
  playerToken: string | undefined,
): Credentials | null {
  const parsed = playerIdSchema.safeParse(playerId);
  if (!parsed.success || !playerToken) return null;
  return { playerId: parsed.data, playerToken };
}
