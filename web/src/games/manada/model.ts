import {
  isManadaPlayer,
  MANADA_WIN_POINTS,
  type ManadaConfig,
  type ManadaGroup,
  type ManadaPublic,
} from '@family-night/shared';
import type { GroupVerdict } from './GroupCard';

export type Seat = 'PLAYER' | 'SPECTATOR';

export function seatOf(match: ManadaPublic, playerId: string): Seat {
  return isManadaPlayer(match, playerId) ? 'PLAYER' : 'SPECTATOR';
}

export function roundsLabel(count: number): string {
  return count === 1 ? '1 ronda' : `${String(count)} rondas`;
}

export function pointsLabel(count: number): string {
  return count === 1 ? '1 punto' : `${String(count)} puntos`;
}

export function goalLabel(config: ManadaConfig): string {
  return config.goal === 'ROUNDS'
    ? roundsLabel(config.rounds)
    : `hasta ${pointsLabel(MANADA_WIN_POINTS)}`;
}

function largestOf(groups: readonly ManadaGroup[]): number {
  return groups[0]?.playerIds.length ?? 0;
}

export function verdictOf(group: ManadaGroup, groups: readonly ManadaGroup[]): GroupVerdict {
  if (group.points > 0) return 'SCORES';
  const largest = largestOf(groups);
  return largest >= 2 && group.playerIds.length === largest ? 'TIED' : null;
}

export function outcomeOf(groups: readonly ManadaGroup[]): string {
  const scoring = groups.find((group) => group.points > 0);
  if (scoring) return `Suma la manada de «${scoring.labels.join(' / ')}»`;
  if (groups.length === 0) return 'Nadie respondió';
  return largestOf(groups) >= 2
    ? 'Empatan las manadas más grandes: nadie suma'
    : 'Nadie coincidió: nadie suma';
}
