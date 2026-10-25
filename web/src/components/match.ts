import type { Player } from '@family-night/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export function nameOf(members: readonly Player[], playerId: string): string {
  return members.find((member) => member.playerId === playerId)?.name ?? 'Alguien que salió';
}

export function vibrate(): void {
  if ('vibrate' in navigator) navigator.vibrate(50);
}

export function usePhaseVibration(step: string): void {
  const previous = useRef(step);
  useEffect(() => {
    if (previous.current !== step) vibrate();
    previous.current = step;
  }, [step]);
}

export function useRoundDraft(round: number) {
  const [draft, setDraft] = useState({ round, text: '' });
  const text = draft.round === round ? draft.text : '';
  const update = useCallback(
    (next: string) => {
      setDraft({ round, text: next });
    },
    [round],
  );
  return [text, update] as const;
}
