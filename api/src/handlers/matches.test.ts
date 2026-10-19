import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ONLINE_WINDOW_MS, type RoomResponse, type RoomSnapshot } from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import { bankEntries } from '../services/impostor/words.ts';
import {
  call,
  expectError,
  getRoom,
  join,
  json,
  newPlayer,
  roomWith,
  updates,
} from '../test/harness.ts';
import {
  currentMatch,
  everyoneVotes,
  hostAction,
  impostorConfig,
  matchPath,
  rolesOf,
  secretOf,
  start,
  type Room,
} from '../test/impostor.ts';

function startCall(room: Room, config: unknown, player = room.host) {
  return call(room.harness, player, 'POST', `/api/rooms/${room.code}/matches`, {
    gameType: 'IMPOSTOR',
    config,
  });
}

async function finishByCatchingImpostor(room: Room, snapshot: RoomSnapshot) {
  const match = currentMatch(snapshot);
  const roles = await rolesOf(room, match);
  const [impostor] = roles.impostors;
  const [civilian] = roles.civilians;
  if (!impostor || !civilian) throw new Error('a match needs an impostor and a civilian');
  const revealed = await everyoneVotes(room, match, impostor, civilian);
  const finished = await hostAction(room, revealed, 'next-round', { round: revealed.round });
  return { finished, roles };
}

function storedRoom(room: Room) {
  return room.harness.client
    .send(new GetCommand({ TableName: room.harness.tables.rooms, Key: { roomCode: room.code } }))
    .then(({ Item }) => Item);
}

describe('starting a match', () => {
  test('the host starts with the online members, every phone gets the match in one publish', async () => {
    const room = await roomWith(4);
    room.harness.advance(ONLINE_WINDOW_MS);
    for (const player of room.players.slice(0, 3)) {
      await json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/ping`));
    }
    room.harness.published.length = 0;

    const snapshot = await start(room);
    const match = currentMatch(snapshot);

    expect(match).toMatchObject({
      gameType: 'IMPOSTOR',
      status: 'PLAYING',
      phase: 'VOTING',
      round: 1,
    });
    expect(match.participants).toEqual(room.players.slice(0, 3).map((player) => player.playerId));
    expect(match.order.toSorted()).toEqual(match.participants.toSorted());
    expect(updates(room.harness)).toEqual([snapshot]);
    expect(await getRoom(room.harness, room.member(3), room.code)).toEqual(snapshot);
  });

  test('each participant gets a secret and the late member is a spectator with none', async () => {
    const room = await roomWith(4);
    room.harness.advance(ONLINE_WINDOW_MS);
    for (const player of room.players.slice(0, 3)) {
      await json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/ping`));
    }
    const match = currentMatch(await start(room));

    const roles = await rolesOf(room, match);
    expect(roles.impostors).toHaveLength(1);
    expect(roles.civilians).toHaveLength(2);
    const civilian = await secretOf(room, roles.civilians[0] ?? room.host, match.matchId);
    const entry = bankEntries.find((candidate) => candidate.word === roles.word);
    expect(civilian).toEqual({
      role: 'CIVILIAN',
      word: entry?.word,
      category: entry?.categoryName,
    });
    const impostor = await secretOf(room, roles.impostors[0] ?? room.host, match.matchId);
    expect(impostor).toEqual({ role: 'IMPOSTOR', clue: entry?.clue, category: null });
    expect(await secretOf(room, room.member(3), match.matchId)).toBeNull();
  });

  test('a member who joins mid-match sees it as a spectator with no secret', async () => {
    const room = await roomWith(3);
    const match = currentMatch(await start(room));
    const latecomer = await newPlayer(room.harness);

    const snapshot = await join(room.harness, latecomer, room.code);

    expect(currentMatch(snapshot)).toEqual(match);
    expect(match.participants).not.toContain(latecomer.playerId);
    expect(await secretOf(room, latecomer, match.matchId)).toBeNull();
  });

  test('impostors see the category only when the host enables it', async () => {
    const room = await roomWith(3);
    const match = currentMatch(await start(room, { showCategoryToImpostor: true }));
    const roles = await rolesOf(room, match);
    const secret = await secretOf(room, roles.impostors[0] ?? room.host, match.matchId);
    const entry = bankEntries.find((candidate) => candidate.word === roles.word);
    expect(secret).toEqual({ role: 'IMPOSTOR', clue: entry?.clue, category: entry?.categoryName });
  });

  test('fewer than 3 online members cannot start', async () => {
    const room = await roomWith(3);
    room.harness.advance(ONLINE_WINDOW_MS);
    await json(call(room.harness, room.host, 'POST', `/api/rooms/${room.code}/ping`));
    await json(call(room.harness, room.member(1), 'POST', `/api/rooms/${room.code}/ping`));

    const error = await expectError(startCall(room, impostorConfig()), 422, 'NOT_ENOUGH_PLAYERS');
    expect(error.message).toBe('Se necesitan al menos 3 jugadores en línea');
    expect((await getRoom(room.harness, room.host, room.code)).currentMatch).toBeNull();
  });

  test('too many impostors, no category or an unknown category is refused in Spanish', async () => {
    const room = await roomWith(5);

    const tooMany = await expectError(
      startCall(room, impostorConfig({ impostorCount: 2 })),
      422,
      'INVALID_CONFIG',
    );
    expect(tooMany.message).toBe('Con 5 jugadores puede haber como máximo 1 impostor');
    const none = await expectError(
      startCall(room, impostorConfig({ categories: [] })),
      422,
      'INVALID_CONFIG',
    );
    expect(none.message).toBe('Elige al menos una categoría');
    await expectError(
      startCall(room, impostorConfig({ categories: ['nope'] })),
      422,
      'INVALID_CONFIG',
    );
    expect((await getRoom(room.harness, room.host, room.code)).currentMatch).toBeNull();
  });

  test('only the host starts, and never over a running match', async () => {
    const room = await roomWith(3);
    await expectError(startCall(room, impostorConfig(), room.member(1)), 403, 'NOT_HOST');
    await start(room);
    await expectError(startCall(room, impostorConfig()), 409, 'MATCH_IN_PROGRESS');
  });

  test('a start remembers its config on the room', async () => {
    const room = await roomWith(3);
    const config = impostorConfig({ tieRule: 'SKIP', categories: ['comida'] });
    const snapshot = await start(room, config);
    expect(snapshot.configs.IMPOSTOR).toEqual(config);
  });
});

describe('the room config', () => {
  test('a new room carries the default config with every category', async () => {
    const room = await roomWith(1);
    const snapshot = await getRoom(room.harness, room.host, room.code);
    expect(snapshot.configs.IMPOSTOR).toEqual(impostorConfig());
  });

  test('the host changes it and every member sees it live', async () => {
    const room = await roomWith(2);
    room.harness.published.length = 0;
    const config = impostorConfig({ randomOrder: false, categories: ['marcas', 'deportes'] });

    const { room: snapshot } = await json<RoomResponse>(
      call(room.harness, room.host, 'PUT', `/api/rooms/${room.code}/config`, {
        gameType: 'IMPOSTOR',
        config,
      }),
    );

    expect(snapshot.configs.IMPOSTOR).toEqual(config);
    expect(updates(room.harness)).toEqual([snapshot]);
    expect((await getRoom(room.harness, room.member(1), room.code)).configs.IMPOSTOR).toEqual(
      config,
    );
  });

  test('a member cannot change it and an invalid one is refused', async () => {
    const room = await roomWith(2);
    const put = (player = room.host, config: unknown = impostorConfig()) =>
      call(room.harness, player, 'PUT', `/api/rooms/${room.code}/config`, {
        gameType: 'IMPOSTOR',
        config,
      });
    await expectError(put(room.member(1)), 403, 'NOT_HOST');
    await expectError(
      put(room.host, { ...impostorConfig(), tieRule: 'NEVER' }),
      422,
      'INVALID_CONFIG',
    );
    await expectError(put(room.host, impostorConfig({ categories: [] })), 422, 'INVALID_CONFIG');
  });
});

describe('secrets', () => {
  test('/me answers only the caller and only to members of the room', async () => {
    const room = await roomWith(3);
    const match = currentMatch(await start(room));
    const stranger = await newPlayer(room.harness);

    await expectError(
      call(room.harness, stranger, 'GET', matchPath(room, match.matchId, 'me')),
      403,
      'NOT_MEMBER',
    );
    await expectError(
      call(room.harness, room.host, 'GET', matchPath(room, '01ARZ3NDEKTSV4RRFFQ69G5FAV', 'me')),
      404,
      'MATCH_NOT_FOUND',
    );
    await expectError(
      call(room.harness, room.host, 'GET', matchPath(room, 'not-a-ulid', 'me')),
      400,
      'VALIDATION_ERROR',
    );
  });

  test('no snapshot or event of a live match carries the word, the clue or a role', async () => {
    const room = await roomWith(4);
    const match = currentMatch(await start(room));
    const roles = await rolesOf(room, match);
    const [impostor] = roles.impostors;
    const [civilian] = roles.civilians;
    if (!impostor || !civilian) throw new Error('missing roles');
    await everyoneVotes(room, match, civilian, impostor);
    const reads = await Promise.all(
      room.players.map((player) => getRoom(room.harness, player, room.code)),
    );
    expect(reads.map((read) => currentMatch(read).phase)).toEqual(reads.map(() => 'REVEAL'));

    const wire = JSON.stringify([room.harness.published, reads]);
    expect(wire).not.toContain(JSON.stringify(roles.word));
    expect(wire).not.toContain(JSON.stringify(roles.clue));
    expect(wire).not.toContain('CIVILIAN');
    expect(wire).not.toContain('"role"');
    expect(wire).not.toContain('impostorIds');
    expect(wire).not.toContain('targetId');
  });
});

describe('abort, lobby and rematch', () => {
  test('the host ends a match without points and everyone returns to the lobby', async () => {
    const room = await roomWith(3);
    const match = currentMatch(await start(room));

    await expectError(
      call(room.harness, room.member(1), 'POST', matchPath(room, match.matchId, 'abort')),
      403,
      'NOT_HOST',
    );
    const snapshot = await hostAction(room, match, 'abort');

    expect(snapshot.currentMatch).toBeNull();
    expect(snapshot.members.every((member) => member.totalScore === 0)).toBe(true);
    const { Item } = await room.harness.client.send(
      new GetCommand({
        TableName: room.harness.tables.matches,
        Key: { roomCode: room.code, matchId: match.matchId },
      }),
    );
    expect(Item).toMatchObject({ status: 'ABORTED', publicState: { status: 'ABORTED' } });
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'abort')),
      409,
      'STALE_ROUND',
    );
  });

  test('the lobby is refused while playing and clears a finished match', async () => {
    const room = await roomWith(3);
    const started = await start(room);
    const lobby = () => call(room.harness, room.host, 'POST', `/api/rooms/${room.code}/lobby`);
    await expectError(lobby(), 409, 'MATCH_IN_PROGRESS');

    const { finished, roles } = await finishByCatchingImpostor(room, started);
    expect(currentMatch(finished)).toMatchObject({ status: 'FINISHED', winner: 'CIVILIANS' });

    const { room: snapshot } = await json<RoomResponse>(lobby());
    expect(snapshot.currentMatch).toBeNull();
    const scores = Object.fromEntries(snapshot.members.map((m) => [m.playerId, m.totalScore]));
    for (const civilian of roles.civilians) expect(scores[civilian.playerId]).toBe(1);
    for (const impostor of roles.impostors) expect(scores[impostor.playerId]).toBe(0);
  });

  test('a rematch keeps the config and picks a word not seen that night', async () => {
    const room = await roomWith(3);
    const config = { categories: ['animales'] };
    let snapshot = await start(room, config);
    const words: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { finished, roles } = await finishByCatchingImpostor(room, snapshot);
      words.push(roles.word);
      snapshot = await hostAction(room, currentMatch(finished), 'rematch');
      expect(currentMatch(snapshot)).toMatchObject({ phase: 'VOTING', round: 1 });
      expect(currentMatch(snapshot).config).toEqual(impostorConfig(config));
    }
    words.push((await rolesOf(room, currentMatch(snapshot))).word);

    expect(new Set(words).size).toBe(4);
    const stored = await storedRoom(room);
    expect(stored?.usedWordIds).toHaveLength(4);
  });

  test('an exhausted category starts over without the other categories losing their history', async () => {
    const room = await roomWith(3);
    const animals = bankEntries.filter((entry) => entry.category === 'animales').map((e) => e.id);
    await room.harness.client.send(
      new UpdateCommand({
        TableName: room.harness.tables.rooms,
        Key: { roomCode: room.code },
        UpdateExpression: 'SET usedWordIds = :used',
        ExpressionAttributeValues: { ':used': [...animals, 'comida.palta'] },
      }),
    );

    const match = currentMatch(await start(room, { categories: ['animales'] }));
    const { word } = await rolesOf(room, match);

    const stored = await storedRoom(room);
    const picked = bankEntries.find((entry) => entry.word === word);
    expect(picked?.category).toBe('animales');
    expect(stored?.usedWordIds).toEqual(['comida.palta', picked?.id]);
  });

  test('a rematch is refused while playing and when the config no longer fits', async () => {
    const room = await roomWith(6);
    const started = await start(room, { impostorCount: 2 });
    const match = currentMatch(started);
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'rematch')),
      409,
      'MATCH_IN_PROGRESS',
    );

    await hostAction(room, match, 'abort');
    const again = await start(room, { impostorCount: 2 });
    const roles = await rolesOf(room, currentMatch(again));
    let latest = currentMatch(again);
    for (const impostor of roles.impostors) {
      latest = await everyoneVotes(room, latest, impostor, roles.civilians[0] ?? room.host);
      latest = currentMatch(await hostAction(room, latest, 'next-round', { round: latest.round }));
    }
    expect(latest.status).toBe('FINISHED');

    room.harness.advance(ONLINE_WINDOW_MS);
    for (const player of room.players.slice(0, 5)) {
      await json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/ping`));
    }
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, latest.matchId, 'rematch')),
      422,
      'INVALID_CONFIG',
    );
  });
});

describe('rooms stored before the last chance was removed', () => {
  test('a stored Impostor config with the removed setting still starts and rematches', async () => {
    const room = await roomWith(3);
    await room.harness.client.send(
      new UpdateCommand({
        TableName: room.harness.tables.rooms,
        Key: { roomCode: room.code },
        UpdateExpression: 'SET configs = :configs',
        ExpressionAttributeValues: {
          ':configs': { IMPOSTOR: { ...impostorConfig(), impostorLastGuess: true } },
        },
      }),
    );
    const { configs } = await getRoom(room.harness, room.host, room.code);

    const { room: started } = await json<RoomResponse>(startCall(room, configs.IMPOSTOR), 201);
    expect(currentMatch(started).config).toEqual(impostorConfig());
    const { finished } = await finishByCatchingImpostor(room, started);
    const again = await hostAction(room, currentMatch(finished), 'rematch');
    expect(currentMatch(again)).toMatchObject({ phase: 'VOTING', config: impostorConfig() });
  });

  test('a match left in the removed last-chance phase can only be aborted', async () => {
    const room = await roomWith(3);
    const match = currentMatch(await start(room));
    const [voter, target] = room.players;
    if (!voter || !target) throw new Error('missing players');
    await room.harness.client.send(
      new UpdateCommand({
        TableName: room.harness.tables.matches,
        Key: { roomCode: room.code, matchId: match.matchId },
        UpdateExpression: 'SET publicState.phase = :phase, publicState.guess = :guess',
        ExpressionAttributeValues: {
          ':phase': 'IMPOSTOR_GUESS',
          ':guess': { guesserId: target.playerId, options: [], chosen: null, correct: null },
        },
      }),
    );
    const path = (action: string) => matchPath(room, match.matchId, action);

    await expectError(
      call(room.harness, room.host, 'POST', path('next-round'), { round: 1 }),
      409,
      'STALE_ROUND',
    );
    await expectError(
      call(room.harness, room.host, 'POST', path('close-voting'), { round: 1 }),
      409,
      'STALE_ROUND',
    );
    await expectError(
      call(room.harness, voter, 'PUT', path('votes'), {
        round: 1,
        targetId: target.playerId,
        confirmed: true,
      }),
      409,
      'STALE_ROUND',
    );
    const aborted = await hostAction(room, match, 'abort');
    expect(aborted.currentMatch).toBeNull();
  });
});

describe('matches stored before departures were recorded', () => {
  test('an Impostor match without departedIds reads it as empty and still scores', async () => {
    const room = await roomWith(4);
    const match = currentMatch(await start(room));
    await room.harness.client.send(
      new UpdateCommand({
        TableName: room.harness.tables.matches,
        Key: { roomCode: room.code, matchId: match.matchId },
        UpdateExpression: 'REMOVE publicState.departedIds',
      }),
    );
    expect(currentMatch(await getRoom(room.harness, room.host, room.code)).departedIds).toEqual([]);
    const roles = await rolesOf(room, match);
    const [impostor] = roles.impostors;
    const leaver = roles.civilians.find((civilian) => civilian.playerId !== room.host.playerId);
    if (!impostor || !leaver) throw new Error('missing roles');

    await json(call(room.harness, leaver, 'POST', `/api/rooms/${room.code}/leave`));
    const snapshot = await getRoom(room.harness, room.host, room.code);
    expect(currentMatch(snapshot).departedIds).toEqual([leaver.playerId]);
    const stayer = roles.civilians.find((civilian) => civilian !== leaver) ?? room.host;
    const revealed = await everyoneVotes(room, currentMatch(snapshot), impostor, stayer);
    const finished = await hostAction(room, revealed, 'next-round', { round: 1 });

    expect(currentMatch(finished)).toMatchObject({ status: 'FINISHED', winner: 'CIVILIANS' });
    for (const member of finished.members) {
      expect(member.totalScore).toBe(member.playerId === impostor.playerId ? 0 : 1);
    }
  });
});

describe('a living player leaves or is kicked', () => {
  test('a kicked civilian is out with the role shown, their confirmed ballots are dropped and voters vote again', async () => {
    const room = await roomWith(5);
    const match = currentMatch(await start(room));
    const roles = await rolesOf(room, match);
    const [impostor] = roles.impostors;
    const [target, voter, other] = roles.civilians;
    if (!impostor || !target || !voter || !other) throw new Error('missing roles');
    const host = room.host;
    const kicked = target.playerId === host.playerId ? other : target;

    await json(
      call(room.harness, voter, 'PUT', matchPath(room, match.matchId, 'votes'), {
        round: 1,
        targetId: kicked.playerId,
        confirmed: true,
      }),
    );
    await json(
      call(room.harness, kicked, 'PUT', matchPath(room, match.matchId, 'votes'), {
        round: 1,
        targetId: impostor.playerId,
        confirmed: true,
      }),
    );

    const { room: snapshot } = await json<RoomResponse>(
      call(room.harness, host, 'POST', `/api/rooms/${room.code}/kick`, {
        playerId: kicked.playerId,
      }),
    );
    const after = currentMatch(snapshot);

    expect(after.phase).toBe('VOTING');
    expect(after.eliminated).toEqual([
      { playerId: kicked.playerId, round: 1, wasImpostor: false, reason: 'KICKED' },
    ]);
    expect(after.order).not.toContain(kicked.playerId);
    expect(after.votedPlayerIds).toEqual([]);

    const { room: revoted } = await json<RoomResponse>(
      call(room.harness, voter, 'PUT', matchPath(room, match.matchId, 'votes'), {
        round: 1,
        targetId: impostor.playerId,
        confirmed: true,
      }),
    );
    expect(currentMatch(revoted).votedPlayerIds).toEqual([voter.playerId]);
  });

  test('the last impostor leaving gives civilians the win', async () => {
    const room = await roomWith(4);
    const match = currentMatch(await start(room));
    const roles = await rolesOf(room, match);
    const [impostor] = roles.impostors;
    if (!impostor) throw new Error('missing impostor');

    await json(call(room.harness, impostor, 'POST', `/api/rooms/${room.code}/leave`));
    const snapshot = await getRoom(room.harness, roles.civilians[0] ?? room.host, room.code);
    const after = currentMatch(snapshot);

    expect(after).toMatchObject({ status: 'FINISHED', winner: 'CIVILIANS' });
    expect(after.eliminated).toEqual([
      { playerId: impostor.playerId, round: 1, wasImpostor: true, reason: 'LEFT' },
    ]);
    expect(after.reveal).toMatchObject({ word: roles.word, impostorIds: [impostor.playerId] });
    for (const member of snapshot.members) expect(member.totalScore).toBe(1);
  });

  test('a departure that leaves every living player voted closes the round', async () => {
    const room = await roomWith(4);
    const match = currentMatch(await start(room, { tieRule: 'SKIP' }));
    const roles = await rolesOf(room, match);
    const [impostor] = roles.impostors;
    const leaver = roles.civilians.find((civilian) => civilian.playerId !== room.host.playerId);
    if (!impostor || !leaver) throw new Error('missing roles');
    for (const playerId of match.order) {
      const player = room.players.find((candidate) => candidate.playerId === playerId);
      if (!player || player === leaver) continue;
      await json(
        call(room.harness, player, 'PUT', matchPath(room, match.matchId, 'votes'), {
          round: 1,
          targetId:
            player === impostor
              ? (roles.civilians.find((c) => c !== leaver) ?? room.host).playerId
              : impostor.playerId,
          confirmed: true,
        }),
      );
    }

    await json(call(room.harness, leaver, 'POST', `/api/rooms/${room.code}/leave`));
    const after = currentMatch(await getRoom(room.harness, room.host, room.code));

    expect(after.phase).toBe('REVEAL');
    expect(after.lastResult?.eliminatedId).toBe(impostor.playerId);
  });
});
