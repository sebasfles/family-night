import { useState } from 'react';

interface StoredGuess {
  round: number;
  value: number;
}

const key = (matchId: string) => `family-night.guess.${matchId}`;

function read(matchId: string): StoredGuess | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key(matchId)) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { round, value } = parsed as Record<string, unknown>;
    return typeof round === 'number' && typeof value === 'number' ? { round, value } : null;
  } catch {
    return null;
  }
}

export function useMyGuess(matchId: string, round: number) {
  const [guess, setGuess] = useState(() => read(matchId));
  const remember = (value: number) => {
    const next = { round, value };
    setGuess(next);
    try {
      sessionStorage.setItem(key(matchId), JSON.stringify(next));
    } catch {
      return;
    }
  };
  return [guess?.round === round ? guess.value : null, remember] as const;
}
