import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  PLAYER_ID_HEADER,
  PLAYER_TOKEN_HEADER,
  type CreatePlayerResponse,
  type ErrorResponse,
  type MeResponse,
  type RenamePlayerResponse,
} from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import names from '../data/names.json' with { type: 'json' };
import {
  authHeaders,
  call,
  createHarness,
  createRoom,
  expectError,
  getRoom,
  join,
  json,
  newPlayer,
  roomWith,
  updates,
  type Harness,
} from '../test/harness.ts';

const firstName = `${names.animals[0] ?? ''} ${names.adjectives[0] ?? ''}`;

describe('POST /api/players', () => {
  test('creates a player with a token and a name, storing only the token hash', async () => {
    const harness = await createHarness();
    const player = await newPlayer(harness);

    expect(player.playerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(player.playerToken).toMatch(/^[\w-]{43}$/);
    expect(player.name).toMatch(/^\p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+$/u);

    const { Item } = await harness.client.send(
      new GetCommand({ TableName: harness.tables.players, Key: { playerId: player.playerId } }),
    );
    expect(Item?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(Item)).not.toContain(player.playerToken);
    const { Item: claimed } = await harness.client.send(
      new GetCommand({ TableName: harness.tables.playerNames, Key: { name: player.name } }),
    );
    expect(claimed?.playerId).toBe(player.playerId);
  });

  test('a taken name is retried with another combination', async () => {
    const draws = [0, 0, 0, 0, 0.5, 0.5];
    const harness = await createHarness({ random: () => draws.shift() ?? 0.9 });

    const first = await newPlayer(harness);
    const second = await newPlayer(harness);

    expect(first.name).toBe(firstName);
    expect(second.name).toBe(`${names.animals[50] ?? ''} ${names.adjectives[50] ?? ''}`);
  });

  test('after 20 collisions the name gets a number from 2', async () => {
    const harness = await createHarness({ random: () => 0 });

    const names = [];
    for (let i = 0; i < 3; i++) names.push((await newPlayer(harness)).name);

    expect(names).toEqual([firstName, `${firstName} 2`, `${firstName} 3`]);
  });
});

describe('GET /api/players/me', () => {
  test('answers the stored identity', async () => {
    const harness = await createHarness();
    const player = await newPlayer(harness);

    const response = await harness.app.request('/api/players/me', { headers: authHeaders(player) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<MeResponse>({
      playerId: player.playerId,
      name: player.name,
    });
  });

  test.each([
    ['no headers', {}],
    ['a wrong token', { token: 'x'.repeat(43) }],
    ['an unknown player', { id: '00000000-0000-4000-8000-000000000000' }],
    ['a malformed id', { id: 'nope' }],
  ])('answers 401 UNAUTHORIZED for %s', async (_, override: { id?: string; token?: string }) => {
    const harness = await createHarness();
    const player = await newPlayer(harness);
    const headers =
      Object.keys(override).length === 0
        ? {}
        : {
            [PLAYER_ID_HEADER]: override.id ?? player.playerId,
            [PLAYER_TOKEN_HEADER]: override.token ?? player.playerToken,
          };

    const response = await harness.app.request('/api/players/me', { headers });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual<ErrorResponse>({
      error: { code: 'UNAUTHORIZED', message: 'No pudimos reconocer este celular' },
    });
  });
});

function rename(harness: Harness, player: CreatePlayerResponse, name: string, roomCode: string) {
  return call(harness, player, 'PATCH', '/api/players/me', { name, roomCode });
}

async function nameOwner(harness: Harness, name: string): Promise<unknown> {
  const { Item } = await harness.client.send(
    new GetCommand({ TableName: harness.tables.playerNames, Key: { name } }),
  );
  return Item?.playerId;
}

describe('PATCH /api/players/me', () => {
  test('renames the player everywhere it is stored and publishes only the new name', async () => {
    const room = await roomWith(3);
    const [, player] = room.players;
    if (!player) throw new Error('missing player');
    const before = await getRoom(room.harness, room.host, room.code);
    room.harness.published.length = 0;

    const renamed = await json<RenamePlayerResponse>(
      rename(room.harness, player, '  Tía   Marta ', room.code),
    );

    expect(renamed.player).toEqual({ playerId: player.playerId, name: 'Tía Marta' });
    const expected = {
      ...before,
      version: before.version + 1,
      members: before.members.map((member) =>
        member.playerId === player.playerId ? { ...member, name: 'Tía Marta' } : member,
      ),
    };
    const strip = (snapshot: typeof before) => ({
      ...snapshot,
      serverTime: undefined,
      members: snapshot.members.map((member) => ({ ...member, lastSeenAt: undefined })),
    });
    expect(strip(renamed.room)).toEqual(strip(expected));
    expect(updates(room.harness).map(strip)).toEqual([strip(renamed.room)]);

    const me = await json<MeResponse>(call(room.harness, player, 'GET', '/api/players/me'));
    expect(me.name).toBe('Tía Marta');
    expect(await nameOwner(room.harness, 'Tía Marta')).toBe(player.playerId);
    expect(await nameOwner(room.harness, player.name)).toBeUndefined();
  });

  test('the old name is free for anyone after the change', async () => {
    const room = await roomWith(2);
    const [, player] = room.players;
    if (!player) throw new Error('missing player');
    await json(rename(room.harness, player, 'Abuela Rosa', room.code));
    const stranger = await newPlayer(room.harness);
    const elsewhere = await createRoom(room.harness, stranger);

    const taken = await json<RenamePlayerResponse>(
      rename(room.harness, stranger, player.name, elsewhere.roomCode),
    );
    expect(taken.player.name).toBe(player.name);
    expect(await nameOwner(room.harness, player.name)).toBe(stranger.playerId);
  });

  test('keeping the same name changes nothing and publishes nothing', async () => {
    const room = await roomWith(2);
    const before = await getRoom(room.harness, room.host, room.code);
    room.harness.published.length = 0;

    const same = await json<RenamePlayerResponse>(
      rename(room.harness, room.host, room.host.name, room.code),
    );

    expect(same.room.version).toBe(before.version);
    expect(room.harness.published).toEqual([]);
  });

  test.each([
    ['one character', 'A'],
    ['only spaces', '      '],
    ['21 characters', 'a'.repeat(21)],
    ['a control character', 'Abu\u0007la'],
  ])('refuses %s with INVALID_NAME', async (_, name) => {
    const room = await roomWith(1);
    const error = await expectError(
      rename(room.harness, room.host, name, room.code),
      422,
      'INVALID_NAME',
    );
    expect(error.message).toBe('El nombre debe tener entre 2 y 20 caracteres');
  });

  test('refuses a name another player holds anywhere', async () => {
    const room = await roomWith(1);
    const stranger = await newPlayer(room.harness);
    await createRoom(room.harness, stranger);

    await expectError(rename(room.harness, room.host, stranger.name, room.code), 409, 'NAME_TAKEN');
  });

  test('refuses a name equal to another member of the room ignoring case and accents', async () => {
    const room = await roomWith(2);
    const [, other] = room.players;
    if (!other) throw new Error('missing player');
    await json(rename(room.harness, other, 'Tía Marta', room.code));

    await expectError(rename(room.harness, room.host, 'tia MARTA', room.code), 409, 'NAME_TAKEN');
  });

  test('two players claiming one name at once: one gets it, the other is told it is taken', async () => {
    const harness = await createHarness();
    const [a, b] = [await newPlayer(harness), await newPlayer(harness)];
    const [roomA, roomB] = [await createRoom(harness, a), await createRoom(harness, b)];

    const responses = await Promise.all([
      rename(harness, a, 'Tío Pepe', roomA.roomCode),
      rename(harness, b, 'Tío Pepe', roomB.roomCode),
    ]);

    expect(responses.map((response) => response.status).toSorted()).toEqual([200, 409]);
    const loser = responses.find((response) => response.status === 409);
    expect(((await loser?.json()) as ErrorResponse).error.code).toBe('NAME_TAKEN');
    const winner = responses[0].status === 200 ? a : b;
    expect(await nameOwner(harness, 'Tío Pepe')).toBe(winner.playerId);
  });

  test('another room catches up with the new name when the player opens it again', async () => {
    const room = await roomWith(1);
    const friend = await newPlayer(room.harness);
    const other = await createRoom(room.harness, friend);
    await join(room.harness, room.host, other.roomCode);

    await json(rename(room.harness, room.host, 'Papá Noel', room.code));
    const stale = await getRoom(room.harness, friend, other.roomCode);
    expect(stale.members.find((m) => m.playerId === room.host.playerId)?.name).toBe(room.host.name);

    const rejoined = await join(room.harness, room.host, other.roomCode);
    expect(rejoined.members.find((m) => m.playerId === room.host.playerId)?.name).toBe('Papá Noel');
  });

  test('needs membership of the room it names', async () => {
    const room = await roomWith(1);
    const stranger = await newPlayer(room.harness);

    await expectError(rename(room.harness, stranger, 'Tía Marta', room.code), 403, 'NOT_MEMBER');
    await expectError(rename(room.harness, stranger, 'Tía Marta', 'ZZZZ'), 404, 'ROOM_NOT_FOUND');
    expect(await nameOwner(room.harness, 'Tía Marta')).toBeUndefined();
  });
});
