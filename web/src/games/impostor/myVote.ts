import { useState } from 'react';

export interface MyVote {
  targetId: string;
  confirmed: boolean;
}

interface StoredVote extends MyVote {
  round: number;
}

const key = (matchId: string) => `family-night.vote.${matchId}`;

function read(matchId: string): StoredVote | null {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(key(matchId)) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { round, targetId, confirmed } = parsed as Record<string, unknown>;
    if (typeof round !== 'number' || typeof targetId !== 'string') return null;
    return { round, targetId, confirmed: confirmed === true };
  } catch {
    return null;
  }
}

export function useMyVote(matchId: string, round: number) {
  const [vote, setVote] = useState(() => read(matchId));
  const remember = (next: MyVote) => {
    const stored = { round, ...next };
    setVote(stored);
    try {
      sessionStorage.setItem(key(matchId), JSON.stringify(stored));
    } catch {
      return;
    }
  };
  const current: MyVote | null =
    vote?.round === round ? { targetId: vote.targetId, confirmed: vote.confirmed } : null;
  return [current, remember] as const;
}
