import {
  AWAY_SETBACK_MS,
  HOST_SILENCE_MS,
  IMPOSTOR_DEFAULTS,
  startMatch,
} from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import { iso } from '../lib/time.ts';
import type { MatchItem } from '../repos/matches.ts';
import type { MemberItem } from '../repos/room-members.ts';
import type { RoomItem } from '../repos/rooms.ts';
import { changesSnapshot, resolveHost, touchMember } from './room-state.ts';

const now = Date.parse('2026-10-17T20:00:00.000Z');

function member(
  playerId: string,
  joinedMsAgo: number,
  activeMsAgo: number,
  seenMsAgo = activeMsAgo,
): MemberItem {
  return {
    roomCode: 'ABCD',
    playerId,
    name: playerId,
    joinedAt: iso(now - joinedMsAgo),
    lastSeenAt: iso(now - seenMsAgo),
    lastActiveAt: iso(now - activeMsAgo),
    totalScore: 0,
    ttl: 1,
  };
}

describe('resolveHost', () => {
  test('keeps a host heard from within the silence window', () => {
    const members = [member('host', 9_000, HOST_SILENCE_MS), member('b', 1_000, 0)];
    expect(resolveHost('host', members, now)).toBe('host');
  });

  test('keeps a host who only sent away, since away does not count as silence', () => {
    const members = [member('host', 9_000, 10_000, 10_000 + AWAY_SETBACK_MS), member('b', 1, 0)];
    expect(resolveHost('host', members, now)).toBe('host');
  });

  test('moves a silent host to the oldest online member', () => {
    const members = [
      member('host', 9_000, HOST_SILENCE_MS + 1),
      member('offline-oldest', 8_000, 50_000),
      member('online-old', 7_000, 1_000),
      member('online-new', 1_000, 0),
    ];
    expect(resolveHost('host', members, now)).toBe('online-old');
  });

  test('keeps a silent host when nobody else is online', () => {
    const members = [member('host', 9_000, HOST_SILENCE_MS + 1), member('b', 1_000, 50_000)];
    expect(resolveHost('host', members, now)).toBe('host');
  });

  test('a departed host goes to the oldest online member, else the oldest member', () => {
    expect(resolveHost('gone', [member('a', 9_000, 50_000), member('b', 1_000, 0)], now)).toBe('b');
    expect(resolveHost('gone', [member('a', 1_000, 50_000), member('b', 9_000, 50_000)], now)).toBe(
      'b',
    );
  });

  test('an empty room keeps the departed host until someone joins', () => {
    expect(resolveHost('gone', [], now)).toBe('gone');
  });
});

describe('changesSnapshot', () => {
  const room = { hostId: 'a', version: 3 } as RoomItem;
  const online = member('a', 9_000, 10_000);
  const offline = member('a', 9_000, 50_000);

  test('a plain ping of an online member changes nothing public', () => {
    const before = { room, members: [online], match: null };
    expect(changesSnapshot(before, { hostId: 'a', members: [touchMember(online, now)] }, now)).toBe(
      false,
    );
  });

  test('a ping that brings a member back online changes the snapshot', () => {
    const before = { room, members: [offline], match: null };
    expect(
      changesSnapshot(before, { hostId: 'a', members: [touchMember(offline, now)] }, now),
    ).toBe(true);
  });

  test('a new member, a removed member or a new host change the snapshot', () => {
    const before = { room, members: [online], match: null };
    expect(
      changesSnapshot(before, { hostId: 'a', members: [online, member('b', 0, 0)] }, now),
    ).toBe(true);
    expect(changesSnapshot(before, { hostId: 'a', members: [] }, now)).toBe(true);
    expect(changesSnapshot(before, { hostId: 'b', members: [online] }, now)).toBe(true);
  });

  test('a change of the current match or of a game config changes the snapshot', () => {
    const config = { ...IMPOSTOR_DEFAULTS, categories: ['animales'] };
    const { state: publicState } = startMatch({
      matchId: 'M1',
      config,
      participants: ['a', 'b', 'c'],
      randomInt: () => 0,
    });
    const match = { roomCode: 'ABCD', matchId: 'M1', publicState } as MatchItem;
    const before = { room: { ...room, configs: {} }, members: [online], match };
    const same = { hostId: 'a', members: [online] };

    expect(changesSnapshot(before, same, now)).toBe(false);
    expect(changesSnapshot(before, { ...same, currentMatch: match }, now)).toBe(false);
    expect(changesSnapshot(before, { ...same, currentMatch: null }, now)).toBe(true);
    expect(
      changesSnapshot(
        before,
        {
          ...same,
          currentMatch: { ...match, publicState: { ...publicState, votedPlayerIds: ['a'] } },
        },
        now,
      ),
    ).toBe(true);
    expect(changesSnapshot(before, { ...same, configs: { IMPOSTOR: config } }, now)).toBe(true);
  });
});
