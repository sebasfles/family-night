import { IMPOSTOR_DEFAULTS, ONLINE_WINDOW_MS, type GameConfigs } from '@family-night/shared';
import { expect, test } from 'vitest';
import { iso } from '../lib/time.ts';
import type { MemberItem } from '../repos/room-members.ts';
import { buildSnapshot } from './snapshot.ts';

const now = Date.parse('2026-10-17T20:00:00.000Z');
const configs: GameConfigs = { IMPOSTOR: { ...IMPOSTOR_DEFAULTS, categories: ['animales'] } };

function member(playerId: string, joinedMsAgo: number, seenMsAgo: number): MemberItem {
  return {
    roomCode: 'ABCD',
    playerId,
    name: `Name ${playerId}`,
    joinedAt: iso(now - joinedMsAgo),
    lastSeenAt: iso(now - seenMsAgo),
    lastActiveAt: iso(now - seenMsAgo),
    totalScore: 3,
    ttl: 1,
  };
}

test('the snapshot lists members by join order with online derived from the server time', () => {
  const snapshot = buildSnapshot(
    {
      roomCode: 'ABCD',
      version: 7,
      hostId: 'b',
      members: [member('a', 1_000, ONLINE_WINDOW_MS), member('b', 5_000, ONLINE_WINDOW_MS - 1)],
      currentMatch: null,
      configs,
    },
    now,
  );

  expect(snapshot).toEqual({
    roomCode: 'ABCD',
    version: 7,
    hostId: 'b',
    members: [
      {
        playerId: 'b',
        name: 'Name b',
        online: true,
        lastSeenAt: iso(now - ONLINE_WINDOW_MS + 1),
        totalScore: 3,
        joinedAt: iso(now - 5_000),
      },
      {
        playerId: 'a',
        name: 'Name a',
        online: false,
        lastSeenAt: iso(now - ONLINE_WINDOW_MS),
        totalScore: 3,
        joinedAt: iso(now - 1_000),
      },
    ],
    currentMatch: null,
    configs,
    serverTime: iso(now),
  });
});

test('the snapshot carries no internal field of the stored member', () => {
  const tokenHash = 'f'.repeat(64);
  const stored = { ...member('a', 0, 0), tokenHash } as MemberItem;
  const snapshot = buildSnapshot(
    { roomCode: 'ABCD', version: 1, hostId: 'a', members: [stored], currentMatch: null, configs },
    now,
  );

  expect(Object.keys(snapshot.members[0] ?? {}).sort()).toEqual([
    'joinedAt',
    'lastSeenAt',
    'name',
    'online',
    'playerId',
    'totalScore',
  ]);
  expect(JSON.stringify(snapshot)).not.toContain(tokenHash);
});
