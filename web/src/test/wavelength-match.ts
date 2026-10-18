import type { WavelengthPublic } from '@family-night/shared';

export const WAVELENGTH_MATCH_ID = '01JAB2C3D4E5F6G7H8J9K0M1N3';

export function wavelengthMatch(
  participants: string[],
  overrides: Partial<WavelengthPublic> = {},
): WavelengthPublic {
  const [psychicId = ''] = participants;
  return {
    gameType: 'WAVELENGTH',
    matchId: WAVELENGTH_MATCH_ID,
    status: 'PLAYING',
    phase: 'CLUE',
    config: { cycles: 1 },
    round: 1,
    turn: 0,
    participants,
    order: participants,
    departedIds: [],
    psychicId,
    spectrum: { id: 'frio.caliente', left: 'Frío', right: 'Caliente' },
    clue: null,
    committedPlayerIds: [],
    skipped: null,
    lastResult: null,
    totals: Object.fromEntries(participants.map((id) => [id, 0])),
    ...overrides,
  };
}
