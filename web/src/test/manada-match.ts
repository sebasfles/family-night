import type { ManadaPublic } from '@family-night/shared';

export const MANADA_MATCH_ID = '01JAB2C3D4E5F6G7H8J9K0M1N5';

export function manadaMatch(
  participants: string[],
  overrides: Partial<ManadaPublic> = {},
): ManadaPublic {
  return {
    gameType: 'MANADA',
    matchId: MANADA_MATCH_ID,
    status: 'PLAYING',
    phase: 'ANSWER',
    config: { goal: 'ROUNDS', rounds: 10 },
    round: 1,
    participants,
    departedIds: [],
    question: { id: 'fruta-amarilla', text: 'Una fruta amarilla' },
    answeredPlayerIds: [],
    lastResult: null,
    totals: Object.fromEntries(participants.map((id) => [id, 0])),
    cowHolderId: null,
    winnerIds: [],
    ...overrides,
  };
}
