import type { EliminationReason, ImpostorPublic } from '@family-night/shared';

export type Seat = 'PLAYER' | 'ELIMINATED' | 'SPECTATOR';

export function seatOf(match: ImpostorPublic, playerId: string): Seat {
  if (!match.participants.includes(playerId)) return 'SPECTATOR';
  return match.order.includes(playerId) ? 'PLAYER' : 'ELIMINATED';
}

export function impostorCountLabel(count: number): string {
  return count === 1 ? '1 impostor' : `${String(count)} impostores`;
}

export const reasonLabels: Record<EliminationReason, string> = {
  VOTE: 'por votación',
  TIE_RANDOM: 'por sorteo',
  LEFT: 'salió de la sala',
  KICKED: 'lo sacaron de la sala',
};
