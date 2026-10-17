import type { CreatePlayerResponse } from '@family-night/shared';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { createAuthorizer, type EventsAuthRequest } from './events-auth.ts';
import { call, createHarness, newPlayer, type Harness } from './test/harness.ts';

let harness: Harness;
let member: CreatePlayerResponse;
let outsider: CreatePlayerResponse;
let code: string;
let authorize: ReturnType<typeof createAuthorizer>;

beforeAll(async () => {
  harness = await createHarness();
  member = await newPlayer(harness);
  outsider = await newPlayer(harness);
  const response = await call(harness, member, 'POST', '/api/rooms');
  code = ((await response.json()) as { room: { roomCode: string } }).room.roomCode;
  authorize = createAuthorizer({
    players: harness.deps.repos.players,
    roomMembers: harness.deps.repos.roomMembers,
    clock: harness.now,
  });
});

const tokenOf = (player: CreatePlayerResponse) => `${player.playerId}:${player.playerToken}`;

function request(
  token: string | null,
  operation: string,
  channel: string | null = null,
): EventsAuthRequest {
  return {
    authorizationToken: token,
    requestContext: { operation, channel, channelNamespaceName: channel ? 'rooms' : null },
  };
}

const allowed = { isAuthorized: true, ttlOverride: 300 };
const denied = { isAuthorized: false, ttlOverride: 0 };

describe('EVENT_CONNECT', () => {
  test('allows a valid identity for 300 s', async () => {
    expect(await authorize(request(tokenOf(member), 'EVENT_CONNECT'))).toEqual(allowed);
  });

  test.each([
    ['no token', () => null],
    ['no separator', () => member.playerId + member.playerToken],
    ['a wrong token', () => `${member.playerId}:${'x'.repeat(43)}`],
    ['an unknown player', () => `00000000-0000-4000-8000-000000000000:${member.playerToken}`],
    ['a malformed id', () => `nope:${member.playerToken}`],
  ])('denies %s without caching', async (_, token) => {
    expect(await authorize(request(token(), 'EVENT_CONNECT'))).toEqual(denied);
  });
});

describe('EVENT_SUBSCRIBE', () => {
  test('allows a member to their room channel', async () => {
    expect(await authorize(request(tokenOf(member), 'EVENT_SUBSCRIBE', `/rooms/${code}`))).toEqual(
      allowed,
    );
  });

  test('denies a valid player who is not a member', async () => {
    expect(
      await authorize(request(tokenOf(outsider), 'EVENT_SUBSCRIBE', `/rooms/${code}`)),
    ).toEqual(denied);
  });

  test.each(['/rooms/*', `/rooms/${code}/x`, `/other/${code}`, '/rooms/abcd', null])(
    'denies the channel %j',
    async (channel) => {
      expect(await authorize(request(tokenOf(member), 'EVENT_SUBSCRIBE', channel))).toEqual(denied);
    },
  );

  test('denies a member once they left', async () => {
    const guest = await newPlayer(harness);
    await call(harness, guest, 'POST', `/api/rooms/${code}/join`);
    expect(await authorize(request(tokenOf(guest), 'EVENT_SUBSCRIBE', `/rooms/${code}`))).toEqual(
      allowed,
    );

    await call(harness, guest, 'POST', `/api/rooms/${code}/leave`);

    expect(await authorize(request(tokenOf(guest), 'EVENT_SUBSCRIBE', `/rooms/${code}`))).toEqual(
      denied,
    );
  });
});

test('denies every other operation, publish included', async () => {
  expect(await authorize(request(tokenOf(member), 'EVENT_PUBLISH', `/rooms/${code}`))).toEqual(
    denied,
  );
});

test('logs the player, operation, channel and decision, never the token', async () => {
  const lines: string[] = [];
  const spy = vi.spyOn(console, 'log').mockImplementation((line: string) => lines.push(line));

  await authorize(request(tokenOf(member), 'EVENT_SUBSCRIBE', `/rooms/${code}`));
  await authorize(request(`${member.playerId}:${member.playerToken}x`, 'EVENT_CONNECT'));
  spy.mockRestore();

  expect(lines.map((line) => JSON.parse(line) as unknown)).toEqual([
    expect.objectContaining({
      playerId: member.playerId,
      operation: 'EVENT_SUBSCRIBE',
      channel: `/rooms/${code}`,
      decision: 'allow',
    }),
    expect.objectContaining({ playerId: member.playerId, decision: 'deny' }),
  ]);
  expect(lines.join('\n')).not.toContain(member.playerToken);
});
