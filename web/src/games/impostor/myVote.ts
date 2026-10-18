import { useState } from 'react';

interface StoredVote {
  round: number;
  targetId: string;
}

const key = (matchId: string) => `family-night.vote.${matchId}`;

function read(matchId: string): StoredVote | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key(matchId)) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { round, targetId } = parsed as Record<string, unknown>;
    return typeof round === 'number' && typeof targetId === 'string' ? { round, targetId } : null;
  } catch {
    return null;
  }
}

export function useMyVote(matchId: string, round: number) {
  const [vote, setVote] = useState(() => read(matchId));
  const remember = (targetId: string) => {
    const next = { round, targetId };
    setVote(next);
    try {
      sessionStorage.setItem(key(matchId), JSON.stringify(next));
    } catch {
      return;
    }
  };
  return [vote?.round === round ? vote.targetId : null, remember] as const;
}
