import { isWavelengthPlayer, wavelengthPlayers, type WavelengthPublic } from '@family-night/shared';

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

export function ranking(
  match: WavelengthPublic,
): { playerId: string; points: number; rank: number }[] {
  const rows = wavelengthPlayers(match)
    .map((playerId) => ({ playerId, points: match.totals[playerId] ?? 0 }))
    .toSorted((a, b) => b.points - a.points);
  return rows.map((row) => ({
    ...row,
    rank: 1 + rows.filter((other) => other.points > row.points).length,
  }));
}
