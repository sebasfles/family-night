import type { JustOnePublic } from '@family-night/shared';

export const JUST_ONE_MATCH_ID = '01JAB2C3D4E5F6G7H8J9K0M1N4';

export function justOneMatch(
  participants: string[],
  overrides: Partial<JustOnePublic> = {},
): JustOnePublic {
  const [guesserId = ''] = participants;
  return {
    gameType: 'JUST_ONE',
    matchId: JUST_ONE_MATCH_ID,
    status: 'PLAYING',
    phase: 'CLUE',
    config: { cycles: 1 },
    round: 1,
    turn: 0,
    participants,
    order: participants,
    departedIds: [],
    guesserId,
    committedPlayerIds: [],
    cancelledAuthorIds: [],
    clues: null,
    skipped: null,
    lastResult: null,
    score: 0,
    roundsWon: 0,
    ...overrides,
  };
}
