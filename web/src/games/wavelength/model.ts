import {
  isWavelengthPlayer,
  wavelengthPlayers,
  type WavelengthPublic,
  type WavelengthResult,
} from '@family-night/shared';
import type { ScoreRow } from '../../components/scores';

export type Seat = 'PSYCHIC' | 'GUESSER' | 'SPECTATOR';

export function seatOf(match: WavelengthPublic, playerId: string): Seat {
  if (!isWavelengthPlayer(match, playerId)) return 'SPECTATOR';
  return match.psychicId === playerId ? 'PSYCHIC' : 'GUESSER';
}

export function firstWord(name: string): string {
  return name.split(' ')[0] ?? name;
}

export function pointsLabel(points: number): string {
  return points === 1 ? '1 punto' : `${String(points)} puntos`;
}

function roundPoints(result: WavelengthResult, playerId: string): number {
  if (playerId === result.psychicId) return result.psychicPoints;
  return result.guesses.find((guess) => guess.playerId === playerId)?.points ?? 0;
}

export function scoreRows(match: WavelengthPublic, counting: 'round' | 'match'): ScoreRow[] {
  const result = match.lastResult;
  return wavelengthPlayers(match).map((playerId) => {
    const to = match.totals[playerId] ?? 0;
    const from = counting === 'round' && result ? to - roundPoints(result, playerId) : 0;
    return { playerId, from, to };
  });
}
