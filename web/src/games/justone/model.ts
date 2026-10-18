import { isClueGiver, isJustOnePlayer, type JustOnePublic } from '@family-night/shared';

export type Seat = 'GUESSER' | 'CLUE_GIVER' | 'SPECTATOR';

export function seatOf(match: JustOnePublic, playerId: string): Seat {
  if (!isJustOnePlayer(match, playerId)) return 'SPECTATOR';
  return isClueGiver(match, playerId) ? 'CLUE_GIVER' : 'GUESSER';
}

export function roundsLabel(count: number): string {
  return count === 1 ? '1 ronda' : `${String(count)} rondas`;
}
