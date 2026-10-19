import { IMPOSTOR_DEFAULTS, type ImpostorConfig, type ImpostorPublic } from '@family-night/shared';

export const MATCH_ID = '01JAB2C3D4E5F6G7H8J9K0M1N2';

export function impostorMatch(
  participants: string[],
  overrides: Partial<ImpostorPublic> = {},
  config: Partial<ImpostorConfig> = {},
): ImpostorPublic {
  return {
    gameType: 'IMPOSTOR',
    matchId: MATCH_ID,
    status: 'PLAYING',
    phase: 'VOTING',
    config: { ...IMPOSTOR_DEFAULTS, categories: ['animales'], ...config },
    round: 1,
    participants,
    order: participants,
    eliminated: [],
    votedPlayerIds: [],
    lastResult: null,
    winner: null,
    reveal: null,
    ...overrides,
  };
}
