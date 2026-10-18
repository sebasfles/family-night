import {
  HOST_SILENCE_MS,
  MAX_ROOM_MEMBERS,
  ONLINE_WINDOW_MS,
  type RoomEvent,
  type RoomResponse,
} from '@family-night/shared';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { describe, expect, test, vi } from 'vitest';
import {
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
} from '../test/harness.ts';

describe('create and join', () => {
  test('the creator is host and only member of a new room', async () => {
    const harness = await createHarness();
    const host = await newPlayer(harness);

    const room = await createRoom(harness, host);

    expect(room.roomCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    expect(room).toMatchObject({ version: 1, hostId: host.playerId, currentMatch: null });
    expect(room.members).toEqual([
      expect.objectContaining({ playerId: host.playerId, name: host.name, online: true }),
    ]);
  });

  test('a taken room code is retried', async () => {
    const names = [0.1, 0.2, 0.3, 0.4];
    const draws = [...names, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5];
    const harness = await createHarness({ random: () => draws.shift() ?? 0.1 });
    const [a, b] = [await newPlayer(harness), await newPlayer(harness)];

    expect((await createRoom(harness, a)).roomCode).toBe('AAAA');
    expect((await createRoom(harness, b)).roomCode).toBe('NNNN');
  });

  test('joining adds the member, bumps the version and publishes the snapshot', async () => {
    const harness = await createHarness();
    const host = await newPlayer(harness);
    const guest = await newPlayer(harness);
    const created = await createRoom(harness, host);
    harness.advance(10);

    const room = await join(harness, guest, created.roomCode);

    expect(room.version).toBe(2);
    expect(room.hostId).toBe(host.playerId);
    expect(room.members.map((m) => m.playerId)).toEqual([host.playerId, guest.playerId]);
    expect(harness.published).toEqual([
      { roomCode: created.roomCode, events: [{ type: 'room.updated', room }] },
    ]);
    expect(await getRoom(harness, host, created.roomCode)).toEqual(room);
  });

  test('rejoining while online is idempotent: same member, same version, nothing published', async () => {
    const { harness, member, code } = await roomWith(2);
    const guest = member(1);
    const before = await getRoom(harness, guest, code);
    harness.published.length = 0;
    harness.advance(5_000);

    const room = await join(harness, guest, code);

    expect(room.version).toBe(before.version);
    expect(room.members).toHaveLength(2);
    expect(room.members[1]?.joinedAt).toBe(before.members[1]?.joinedAt);
    expect(harness.published).toEqual([]);
  });

  test('rejoining after being offline publishes the member back online', async () => {
    const { harness, member, code } = await roomWith(2);
    const guest = member(1);
    const before = await getRoom(harness, guest, code);
    harness.published.length = 0;
    harness.advance(ONLINE_WINDOW_MS + 1);

    const room = await join(harness, guest, code);

    expect(room.version).toBe(before.version + 1);
    expect(room.members[1]?.online).toBe(true);
    expect(updates(harness)).toEqual([room]);
  });

  test('the 21st member gets ROOM_FULL with its message', async () => {
    const { harness, code } = await roomWith(MAX_ROOM_MEMBERS);
    const late = await newPlayer(harness);

    const error = await expectError(
      call(harness, late, 'POST', `/api/rooms/${code}/join`),
      409,
      'ROOM_FULL',
    );

    expect(error.message).toBe('La sala está llena, ya hay 20 jugadores');
  });

  test('concurrent joins never pass the 20-member cap', async () => {
    const { harness, host, code } = await roomWith(MAX_ROOM_MEMBERS - 2);
    const late = await Promise.all([1, 2, 3, 4].map(() => newPlayer(harness)));

    const statuses = await Promise.all(
      late.map(
        async (player) => (await call(harness, player, 'POST', `/api/rooms/${code}/join`)).status,
      ),
    );

    expect(statuses.filter((status) => status === 200)).toHaveLength(2);
    expect(statuses.filter((status) => status !== 200).every((s) => s === 409)).toBe(true);
    const room = await getRoom(harness, host, code);
    expect(room.members).toHaveLength(MAX_ROOM_MEMBERS);
    expect(room.version).toBe(MAX_ROOM_MEMBERS);
  });

  test('an unknown room is ROOM_NOT_FOUND and a malformed code is VALIDATION_ERROR', async () => {
    const harness = await createHarness();
    const player = await newPlayer(harness);

    const error = await expectError(
      call(harness, player, 'POST', '/api/rooms/ZZZZ/join'),
      404,
      'ROOM_NOT_FOUND',
    );
    expect(error.message).toBe('Esta sala no existe o ya expiró');
    await expectError(
      call(harness, player, 'POST', '/api/rooms/abcd/join'),
      400,
      'VALIDATION_ERROR',
    );
    await expectError(call(harness, player, 'GET', '/api/rooms/ABCI'), 400, 'VALIDATION_ERROR');
  });

  test('a room past its ttl is treated as gone even before DynamoDB deletes it', async () => {
    const { harness, host, code } = await roomWith(1);
    harness.advance(24 * 60 * 60 * 1000 + 1_000);

    await expectError(call(harness, host, 'GET', `/api/rooms/${code}`), 404, 'ROOM_NOT_FOUND');
  });

  test('a non-member reading the room gets NOT_MEMBER', async () => {
    const { harness, code } = await roomWith(1);
    const stranger = await newPlayer(harness);

    await expectError(call(harness, stranger, 'GET', `/api/rooms/${code}`), 403, 'NOT_MEMBER');
  });

  test('every room route needs the identity headers', async () => {
    const { harness, code } = await roomWith(1);

    const response = await harness.app.request(`/api/rooms/${code}/join`, { method: 'POST' });

    expect(response.status).toBe(401);
  });
});

describe('leave', () => {
  test('a member leaves and the others see it', async () => {
    const { harness, member, host, code } = await roomWith(2);
    const guest = member(1);
    harness.published.length = 0;

    expect(await json(call(harness, guest, 'POST', `/api/rooms/${code}/leave`))).toEqual({
      ok: true,
    });

    const room = await getRoom(harness, host, code);
    expect(room.members.map((m) => m.playerId)).toEqual([host.playerId]);
    expect(updates(harness)).toEqual([room]);
    await expectError(call(harness, guest, 'GET', `/api/rooms/${code}`), 403, 'NOT_MEMBER');
  });

  test('when the host leaves the crown goes to the oldest online member', async () => {
    const { harness, member, host, code } = await roomWith(4);
    const [online, newest] = [member(2), member(3)];
    harness.advance(ONLINE_WINDOW_MS + 1);
    for (const player of [online, newest, host]) {
      await call(harness, player, 'POST', `/api/rooms/${code}/ping`);
    }

    await json(call(harness, host, 'POST', `/api/rooms/${code}/leave`));

    expect((await getRoom(harness, newest, code)).hostId).toBe(online.playerId);
  });

  test('when the host leaves and nobody is online the crown goes to the oldest member', async () => {
    const { harness, member, host, code } = await roomWith(3);
    harness.advance(ONLINE_WINDOW_MS + 1);
    await call(harness, host, 'POST', `/api/rooms/${code}/ping`);

    await json(call(harness, host, 'POST', `/api/rooms/${code}/leave`));

    const [oldest, newest] = [member(1), member(2)];
    const room = updates(harness).at(-1);
    expect(room?.hostId).toBe(oldest.playerId);
    expect(room?.members.map((m) => m.playerId)).toEqual([oldest.playerId, newest.playerId]);
  });

  test('the last member leaving keeps the room, and the next to join becomes host', async () => {
    const { harness, host, code } = await roomWith(1);
    await json(call(harness, host, 'POST', `/api/rooms/${code}/leave`));
    const next = await newPlayer(harness);

    const room = await join(harness, next, code);

    expect(room.hostId).toBe(next.playerId);
    expect(room.members.map((m) => m.playerId)).toEqual([next.playerId]);
  });
});

describe('kick and host handover', () => {
  test('the host kicks a member: kicked event, snapshot without them, and their ping is refused', async () => {
    const { harness, member, host, code } = await roomWith(3);
    const target = member(2);
    harness.published.length = 0;

    const { room } = await json<RoomResponse>(
      call(harness, host, 'POST', `/api/rooms/${code}/kick`, { playerId: target.playerId }),
    );

    expect(room.members.map((m) => m.playerId)).not.toContain(target.playerId);
    expect(harness.published).toEqual([
      {
        roomCode: code,
        events: [
          { type: 'member.kicked', playerId: target.playerId },
          { type: 'room.updated', room },
        ] satisfies RoomEvent[],
      },
    ]);
    await expectError(call(harness, target, 'POST', `/api/rooms/${code}/ping`), 403, 'NOT_MEMBER');
  });

  test('a kick is not a ban: opening the link again rejoins', async () => {
    const { harness, member, host, code } = await roomWith(2);
    const target = member(1);
    await json(
      call(harness, host, 'POST', `/api/rooms/${code}/kick`, { playerId: target.playerId }),
    );

    const room = await join(harness, target, code);

    expect(room.members.map((m) => m.playerId)).toContain(target.playerId);
  });

  test('only the host kicks or hands over, and only to a member', async () => {
    const { harness, member, host, code } = await roomWith(2);
    const guest = member(1);
    const stranger = await newPlayer(harness);

    await expectError(
      call(harness, guest, 'POST', `/api/rooms/${code}/kick`, { playerId: host.playerId }),
      403,
      'NOT_HOST',
    );
    await expectError(
      call(harness, guest, 'POST', `/api/rooms/${code}/host`, { playerId: guest.playerId }),
      403,
      'NOT_HOST',
    );
    const error = await expectError(
      call(harness, host, 'POST', `/api/rooms/${code}/kick`, { playerId: stranger.playerId }),
      409,
      'TARGET_NOT_MEMBER',
    );
    expect(error.message).toBe('Esa persona ya no está en la sala');
    await expectError(
      call(harness, host, 'POST', `/api/rooms/${code}/host`, { playerId: stranger.playerId }),
      409,
      'TARGET_NOT_MEMBER',
    );
    await expectError(
      call(harness, host, 'POST', `/api/rooms/${code}/kick`, { playerId: 'nope' }),
      400,
      'VALIDATION_ERROR',
    );
  });

  test('the host hands the crown over', async () => {
    const { harness, member, host, code } = await roomWith(2);
    const guest = member(1);
    harness.published.length = 0;

    const { room } = await json<RoomResponse>(
      call(harness, host, 'POST', `/api/rooms/${code}/host`, { playerId: guest.playerId }),
    );

    expect(room.hostId).toBe(guest.playerId);
    expect(updates(harness)).toEqual([room]);
    await expectError(
      call(harness, host, 'POST', `/api/rooms/${code}/kick`, { playerId: guest.playerId }),
      403,
      'NOT_HOST',
    );
  });
});

describe('presence and lazy host transfer', () => {
  test('a plain ping answers the room with fresh presence at the same version, publishing nothing', async () => {
    const { harness, member, host, code } = await roomWith(2);
    const guest = member(1);
    const before = await getRoom(harness, host, code);
    harness.published.length = 0;
    harness.advance(20_000);
    await call(harness, guest, 'POST', `/api/rooms/${code}/ping`);
    harness.advance(20_000);

    const { room } = await json<RoomResponse>(
      call(harness, host, 'POST', `/api/rooms/${code}/ping`),
    );

    expect(room.version).toBe(before.version);
    expect(room.serverTime).toBe(new Date(harness.now()).toISOString());
    expect(room.members.find((m) => m.playerId === guest.playerId)).toMatchObject({
      online: true,
      lastSeenAt: new Date(harness.now() - 20_000).toISOString(),
    });
    expect(harness.published).toEqual([]);
  });

  test('a plain ping writes only presence, so a field changed after its read survives', async () => {
    const { harness, member, code } = await roomWith(2);
    const guest = member(1);
    const { roomMembers } = harness.deps.repos;
    const list = roomMembers.list.bind(roomMembers);
    vi.spyOn(roomMembers, 'list').mockImplementationOnce(async (roomCode, nowMs) => {
      const read = await list(roomCode, nowMs);
      await harness.client.send(
        new UpdateCommand({
          TableName: harness.tables.roomMembers,
          Key: { roomCode, playerId: guest.playerId },
          UpdateExpression: 'SET totalScore = :score',
          ExpressionAttributeValues: { ':score': 7 },
        }),
      );
      return read;
    });
    harness.advance(20_000);

    await json<RoomResponse>(call(harness, guest, 'POST', `/api/rooms/${code}/ping`));

    const { Item } = await harness.client.send(
      new GetCommand({
        TableName: harness.tables.roomMembers,
        Key: { roomCode: code, playerId: guest.playerId },
      }),
    );
    expect(Item).toMatchObject({
      totalScore: 7,
      lastSeenAt: new Date(harness.now()).toISOString(),
      lastActiveAt: new Date(harness.now()).toISOString(),
    });
  });

  test('away greys the member out at once, then a ping brings them back, publishing once each', async () => {
    const { harness, member, host, code } = await roomWith(2);
    const guest = member(1);
    harness.published.length = 0;

    const away = await call(harness, guest, 'POST', `/api/rooms/${code}/away`);
    expect(away.status).toBe(204);
    expect(await away.text()).toBe('');
    await call(harness, guest, 'POST', `/api/rooms/${code}/away`);
    harness.advance(1_000);
    await call(harness, guest, 'POST', `/api/rooms/${code}/ping`);
    harness.advance(1_000);
    await call(harness, guest, 'POST', `/api/rooms/${code}/ping`);

    const [hidden, back, ...rest] = updates(harness);
    expect(rest).toEqual([]);
    expect(hidden?.members.find((m) => m.playerId === guest.playerId)?.online).toBe(false);
    expect(back?.members.find((m) => m.playerId === guest.playerId)?.online).toBe(true);
    expect(back?.version).toBe((hidden?.version ?? 0) + 1);
    expect((await getRoom(harness, host, code)).version).toBe(back?.version);
  });

  test('a host silent for 60 s loses the crown to the oldest online member on the next request', async () => {
    const { harness, member, code } = await roomWith(3);
    const [older, newer] = [member(1), member(2)];
    harness.advance(HOST_SILENCE_MS - 1_000);
    await call(harness, newer, 'POST', `/api/rooms/${code}/ping`);
    await call(harness, older, 'POST', `/api/rooms/${code}/ping`);
    harness.published.length = 0;
    harness.advance(2_000);

    const room = await getRoom(harness, newer, code);

    expect(room.hostId).toBe(older.playerId);
    expect(updates(harness)).toEqual([room]);
  });

  test('the away call alone does not cost the host the crown', async () => {
    const { harness, member, host, code } = await roomWith(2);
    const guest = member(1);
    await call(harness, host, 'POST', `/api/rooms/${code}/away`);
    harness.advance(HOST_SILENCE_MS - 5_000);

    await call(harness, guest, 'POST', `/api/rooms/${code}/ping`);
    const room = await getRoom(harness, guest, code);

    expect(room.hostId).toBe(host.playerId);
    expect(room.members[0]?.online).toBe(false);
  });

  test('a returning host who was replaced stays a member without the crown', async () => {
    const { harness, member, host, code } = await roomWith(2);
    const guest = member(1);
    harness.advance(HOST_SILENCE_MS + 1);
    await call(harness, guest, 'POST', `/api/rooms/${code}/ping`);

    const room = await join(harness, host, code);

    expect(room.hostId).toBe(guest.playerId);
    expect(room.members.find((m) => m.playerId === host.playerId)?.online).toBe(true);
  });
});

test('no snapshot or event carries a token or its hash', async () => {
  const { harness, players, member, code } = await roomWith(3);
  const host = member(0);
  await call(harness, host, 'POST', `/api/rooms/${code}/kick`, {
    playerId: member(2).playerId,
  });
  const room = await getRoom(harness, host, code);

  const wire = JSON.stringify([room, harness.published]);
  expect(wire).not.toContain('tokenHash');
  for (const player of players) expect(wire).not.toContain(player.playerToken);
});
