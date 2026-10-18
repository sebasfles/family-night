import type { CreatePlayerResponse } from '@family-night/shared';

export type Identity = CreatePlayerResponse;

const KEY = 'family-night.identity';

let memory: Identity | null = null;

function isIdentity(value: unknown): value is Identity {
  if (typeof value !== 'object' || value === null) return false;
  const { playerId, playerToken, name } = value as Record<string, unknown>;
  return (
    typeof playerId === 'string' && typeof playerToken === 'string' && typeof name === 'string'
  );
}

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (isIdentity(parsed)) return parsed;
    return raw === null ? memory : null;
  } catch {
    return memory;
  }
}

export function saveIdentity(identity: Identity): void {
  memory = identity;
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    return;
  }
}

export function clearIdentity(): void {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    return;
  }
}
