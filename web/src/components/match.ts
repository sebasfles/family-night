import type { RoomMember } from '@family-night/shared';
import { useEffect, useRef } from 'react';

export function nameOf(members: RoomMember[], playerId: string): string {
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
