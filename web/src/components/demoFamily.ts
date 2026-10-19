import type { RoomMember } from '@family-night/shared';

const NAMES = ['Sofía', 'Abuela Rosa', 'Tío Pepe', 'Mateo', 'Papá Luis'] as const;

export const DEMO_FAMILY: RoomMember[] = NAMES.map((name, index) => ({
  playerId: `demo-${String(index + 1)}`,
  name,
  online: true,
  lastSeenAt: '2026-01-01T00:00:00.000Z',
  totalScore: 0,
  joinedAt: '2026-01-01T00:00:00.000Z',
}));

export const DEMO_SELF = 'demo-1';

export const demoId = (index: number): string => DEMO_FAMILY[index]?.playerId ?? DEMO_SELF;
