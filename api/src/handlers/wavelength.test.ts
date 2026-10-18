import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  MAX_ROOM_MEMBERS,
  ONLINE_WINDOW_MS,
  WAVELENGTH_DEFAULTS,
  type RoomResponse,
  type RoomSnapshot,
} from '@family-night/shared';
import { describe, expect, test } from 'vitest';
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
import { impostorConfig, matchPath, start as startImpostor, type Room } from '../test/impostor.ts';
import {
  clueCall,
  fixedTarget,
  giveClue,
  guessCall,
  guessed,
  guessersOf,
  host,
  playRound,
  psychicOf,
  secretOf,
  start,
  startCall,
  wavelength,
} from '../test/wavelength.ts';

function scoresOf(room: RoomSnapshot): Record<string, number> {
  return Object.fromEntries(room.members.map((member) => [member.playerId, member.totalScore]));
}

function leave(room: Room, playerId: string) {
  const player = room.players.find((candidate) => candidate.playerId === playerId);
  if (!player) throw new Error('unknown player');
  return json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/leave`));
}

async function storedGuesses(room: Room, matchId: string) {
  const { Items } = await room.harness.client.send(
    new QueryCommand({
      TableName: room.harness.tables.matchSecrets,
      KeyConditionExpression: 'matchId = :matchId AND begins_with(playerId, :prefix)',
      ExpressionAttributeValues: { ':matchId': matchId, ':prefix': '#GUESS#' },
    }),
  );
  return Items ?? [];
}

function storedRoom(room: Room) {
  return room.harness.client
    .send(new GetCommand({ TableName: room.harness.tables.rooms, Key: { roomCode: room.code } }))
    .then(({ Item }) => Item);
}

describe('starting Wavelength', () => {
  test('the host starts with the online members, one publish, a psychic and a spectrum', async () => {
    const room = await roomWith(4);
    room.harness.advance(ONLINE_WINDOW_MS);
    for (const player of room.players.slice(0, 3)) {
      await json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/ping`));
    }
    room.harness.published.length = 0;

    const { room: snapshot } = await json<RoomResponse>(startCall(room, { cycles: 2 }), 201);
    const match = wavelength(snapshot);

    expect(match).toMatchObject({
      status: 'PLAYING',
      phase: 'CLUE',
      round: 1,
      turn: 0,
      config: { cycles: 2 },
      clue: null,
      committedPlayerIds: [],
      lastResult: null,
    });
    const online = room.players.slice(0, 3).map((player) => player.playerId);
    expect(match.participants).toEqual(online);
    expect(match.order.toSorted()).toEqual(online.toSorted());
    expect(match.psychicId).toBe(match.order[0]);
    expect(match.spectrum.left).not.toBe('');
    expect(snapshot.selectedGame).toBe('WAVELENGTH');
    expect(snapshot.configs.WAVELENGTH).toEqual({ cycles: 2 });
    expect(updates(room.harness)).toEqual([snapshot]);
    expect(await getRoom(room.harness, room.member(3), room.code)).toEqual(snapshot);
  });

  test('fewer than 3 online members or a bad cycle count cannot start', async () => {
    const room = await roomWith(3);
    await expectError(startCall(room, { cycles: 4 }), 422, 'INVALID_CONFIG');
    await expectError(startCall(room, { cycles: 1, extra: 1 }), 422, 'INVALID_CONFIG');
    await expectError(startCall(room, { cycles: 1 }, room.member(1)), 403, 'NOT_HOST');
    room.harness.advance(ONLINE_WINDOW_MS);
    await json(call(room.harness, room.host, 'POST', `/api/rooms/${room.code}/ping`));
    await json(call(room.harness, room.member(1), 'POST', `/api/rooms/${room.code}/ping`));

    await expectError(startCall(room), 422, 'NOT_ENOUGH_PLAYERS');
    expect((await getRoom(room.harness, room.host, room.code)).currentMatch).toBeNull();
  });
});

describe('the selected game and its config', () => {
  test('a new room selects Impostor and carries the Wavelength default', async () => {
    const room = await roomWith(1);
    const snapshot = await getRoom(room.harness, room.host, room.code);
    expect(snapshot.selectedGame).toBe('IMPOSTOR');
    expect(snapshot.configs.WAVELENGTH).toEqual(WAVELENGTH_DEFAULTS);
  });

  test('the host picks a game with its config and every member sees both', async () => {
    const room = await roomWith(2);
    const put = (body: unknown, player = room.host) =>
      call(room.harness, player, 'PUT', `/api/rooms/${room.code}/config`, body);
    room.harness.published.length = 0;

    const { room: snapshot } = await json<RoomResponse>(
      put({ gameType: 'WAVELENGTH', config: { cycles: 3 } }),
    );

    expect(snapshot).toMatchObject({
      selectedGame: 'WAVELENGTH',
      configs: { WAVELENGTH: { cycles: 3 } },
    });
    expect(updates(room.harness)).toEqual([snapshot]);
    expect(await getRoom(room.harness, room.member(1), room.code)).toMatchObject({
      selectedGame: 'WAVELENGTH',
    });
    await expectError(
      put({ gameType: 'WAVELENGTH', config: { cycles: 0 } }),
      422,
      'INVALID_CONFIG',
    );
    await expectError(put({ gameType: 'TRIVIA', config: {} }), 400, 'VALIDATION_ERROR');
    await expectError(
      put({ gameType: 'WAVELENGTH', config: { cycles: 1 } }, room.member(1)),
      403,
      'NOT_HOST',
    );

    const back = await json<RoomResponse>(put({ gameType: 'IMPOSTOR', config: impostorConfig() }));
    expect(back.room).toMatchObject({
      selectedGame: 'IMPOSTOR',
      configs: { WAVELENGTH: { cycles: 3 } },
    });
  });
});

describe('the target stays secret', () => {
  test('/me gives the target only to the psychic of the round, until the reveal', async () => {
    const room = await roomWith(4, { secureRandomInt: fixedTarget(37) });
    const match = await start(room);
    const psychic = psychicOf(room, match);
    const latecomer = await newPlayer(room.harness);
    await join(room.harness, latecomer, room.code);

    expect(await secretOf(room, psychic, match.matchId)).toEqual({
      role: 'PSYCHIC',
      round: 1,
      target: 37,
    });
    for (const guesser of guessersOf(room, match)) {
      expect(await secretOf(room, guesser, match.matchId)).toBeNull();
    }
    expect(await secretOf(room, latecomer, match.matchId)).toBeNull();

    const guessing = await giveClue(room, match);
    expect(await secretOf(room, psychic, match.matchId)).toMatchObject({ target: 37 });

    const revealed = await host(room, guessing, 'close-guessing');
    expect(wavelength(revealed).lastResult?.target).toBe(37);
    expect(await secretOf(room, psychic, match.matchId)).toBeNull();
  });

  test('each round keeps its own target, so a later round stored does not change a reveal', async () => {
    const room = await roomWith(3, { secureRandomInt: fixedTarget(37) });
    const match = await giveClue(room, await start(room));
    await room.harness.client.send(
      new PutCommand({
        TableName: room.harness.tables.matchSecrets,
        Item: {
          matchId: match.matchId,
          playerId: '#ROUND#02',
          round: 2,
          psychicId: match.psychicId,
          target: 90,
          ttl: Math.floor(room.harness.now() / 1000) + 3600,
        },
      }),
    );

    expect(await secretOf(room, psychicOf(room, match), match.matchId)).toMatchObject({
      round: 1,
      target: 37,
    });
    const revealed = wavelength(await host(room, match, 'close-guessing'));
    expect(revealed.lastResult?.target).toBe(37);
  });

  test('no snapshot or event carries the target or a guess before the reveal', async () => {
    const room = await roomWith(4);
    room.harness.published.length = 0;
    const match = await start(room);
    const guessing = await giveClue(room, match, 'Una sopa caliente');
    const [first, second] = guessersOf(room, guessing);
    if (!first || !second) throw new Error('missing guessers');
    await guessed(room, first, guessing, 12);
    await guessed(room, second, guessing, 88);
    const reads = await Promise.all(
      room.players.map((player) => getRoom(room.harness, player, room.code)),
    );

    const wire = JSON.stringify([room.harness.published, reads]);
    expect(wire).toContain('Una sopa caliente');
    expect(wire).not.toContain('"target"');
    expect(wire).not.toContain('"value"');
    expect(wire).not.toContain('PSYCHIC');
    expect(wire).not.toContain('#ROUND');
    expect(wire).not.toContain('#GUESS');
  });
});

describe('a round', () => {
  test('only the psychic gives the clue, once, trimmed and up to 40 characters', async () => {
    const room = await roomWith(3);
    const match = await start(room);
    const [guesser] = guessersOf(room, match);
    if (!guesser) throw new Error('missing guesser');
    const psychic = psychicOf(room, match);

    await expectError(clueCall(room, guesser, match), 403, 'NOT_PSYCHIC');
    await expectError(clueCall(room, psychic, match, 'x'.repeat(41)), 400, 'VALIDATION_ERROR');
    await expectError(clueCall(room, psychic, match, '   '), 400, 'VALIDATION_ERROR');
    await expectError(clueCall(room, psychic, match, 'Sopa', 2), 409, 'STALE_ROUND');

    const { room: snapshot } = await json<RoomResponse>(
      clueCall(room, psychic, match, `  ${'y'.repeat(40)}  `),
    );
    expect(wavelength(snapshot)).toMatchObject({ phase: 'GUESS', clue: 'y'.repeat(40) });
    expect(wavelength(await getRoom(room.harness, guesser, room.code)).clue).toBe('y'.repeat(40));

    room.harness.published.length = 0;
    await expectError(clueCall(room, psychic, match, 'Otra'), 409, 'STALE_ROUND');
    expect(room.harness.published).toEqual([]);
  });

  test('each guesser commits once; the psychic, spectators and bad values are refused', async () => {
    const room = await roomWith(4);
    room.harness.advance(ONLINE_WINDOW_MS);
    for (const player of room.players.slice(0, 3)) {
      await json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/ping`));
    }
    const match = await start(room);
    const [guesser] = guessersOf(room, match);
    if (!guesser) throw new Error('missing guesser');
    await expectError(guessCall(room, guesser, match, 50), 409, 'STALE_ROUND');
    const guessing = await giveClue(room, match);

    await expectError(guessCall(room, psychicOf(room, match), guessing, 50), 422, 'INVALID_GUESS');
    await expectError(guessCall(room, room.member(3), guessing, 50), 422, 'INVALID_GUESS');
    await expectError(guessCall(room, guesser, guessing, 101), 400, 'VALIDATION_ERROR');
    await expectError(guessCall(room, guesser, guessing, 2.5), 400, 'VALIDATION_ERROR');
    await expectError(guessCall(room, guesser, guessing, 50, 2), 409, 'STALE_ROUND');

    const committed = await guessed(room, guesser, guessing, 40);
    expect(committed.committedPlayerIds).toEqual([guesser.playerId]);
    room.harness.published.length = 0;
    await expectError(guessCall(room, guesser, guessing, 90), 409, 'STALE_ROUND');
    expect(room.harness.published).toEqual([]);

    const revealed = wavelength(await host(room, guessing, 'close-guessing'));
    expect(revealed.lastResult?.guesses).toContainEqual(
      expect.objectContaining({ playerId: guesser.playerId, value: 40 }),
    );
  });

  test('the last commit reveals the round with the points of each band', async () => {
    const room = await roomWith(4, { secureRandomInt: fixedTarget(60) });
    const match = await giveClue(room, await start(room));
    const [a, b, c] = guessersOf(room, match);
    if (!a || !b || !c) throw new Error('missing guessers');
    room.harness.published.length = 0;

    await guessed(room, a, match, 55);
    await guessed(room, b, match, 72);
    const revealed = await guessed(room, c, match, 10);

    expect(revealed.phase).toBe('REVEAL');
    expect(revealed.lastResult).toEqual({
      round: 1,
      psychicId: match.psychicId,
      target: 60,
      guesses: [a, b, c]
        .map((player) => player.playerId)
        .sort((x, y) => match.participants.indexOf(x) - match.participants.indexOf(y))
        .map((playerId) => ({
          playerId,
          value: { [a.playerId]: 55, [b.playerId]: 72, [c.playerId]: 10 }[playerId],
          points: { [a.playerId]: 4, [b.playerId]: 2, [c.playerId]: 0 }[playerId],
        })),
      psychicPoints: 2,
    });
    expect(revealed.totals).toEqual({
      [a.playerId]: 4,
      [b.playerId]: 2,
      [c.playerId]: 0,
      [match.psychicId]: 2,
    });
    const reveals = updates(room.harness).filter((s) => wavelength(s).phase === 'REVEAL');
    expect(reveals).toHaveLength(1);
  });

  test(`${String(MAX_ROOM_MEMBERS - 1)} simultaneous guesses reveal the round exactly once`, async () => {
    const room = await roomWith(MAX_ROOM_MEMBERS, { secureRandomInt: fixedTarget(50) });
    const match = await giveClue(room, await start(room));
    const guessers = guessersOf(room, match);
    room.harness.published.length = 0;

    const responses = await Promise.all(
      guessers.map((guesser, index) => guessCall(room, guesser, match, index * 5)),
    );

    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(
      responses.map((response) => response.status),
      JSON.stringify(bodies),
    ).toEqual(guessers.map(() => 200));
    const reveals = updates(room.harness).filter((s) => wavelength(s).phase === 'REVEAL');
    expect(reveals).toHaveLength(1);
    const result = wavelength(reveals[0] ?? (await getRoom(room.harness, room.host, room.code)));
    expect(result.committedPlayerIds).toHaveLength(MAX_ROOM_MEMBERS - 1);
    expect(result.lastResult?.guesses.every((guess) => guess.value !== null)).toBe(true);
  });

  test('the host closes guessing early and missing guesses score 0', async () => {
    const room = await roomWith(4, { secureRandomInt: fixedTarget(30) });
    const match = await giveClue(room, await start(room));
    const [early] = guessersOf(room, match);
    if (!early) throw new Error('missing guesser');
    await guessed(room, early, match, 33);
    const notHost = room.players.find((p) => p.playerId !== room.host.playerId) ?? room.host;
    await expectError(
      call(room.harness, notHost, 'POST', matchPath(room, match.matchId, 'close-guessing'), {
        round: 1,
      }),
      403,
      'NOT_HOST',
    );

    const revealed = wavelength(await host(room, match, 'close-guessing'));

    expect(revealed.lastResult?.psychicPoints).toBe(4);
    for (const guess of revealed.lastResult?.guesses ?? []) {
      expect(guess).toEqual(
        guess.playerId === early.playerId
          ? { playerId: early.playerId, value: 33, points: 4 }
          : { playerId: guess.playerId, value: null, points: 0 },
      );
    }
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'close-guessing'), {
        round: 1,
      }),
      409,
      'STALE_ROUND',
    );
    await expectError(guessCall(room, early, match, 33), 409, 'STALE_ROUND');
  });

  test('a command of the other game answers STALE_ROUND', async () => {
    const room = await roomWith(3);
    const impostor = await startImpostor(room);
    const matchId = impostor.currentMatch?.matchId ?? '';
    await expectError(
      call(room.harness, room.host, 'PUT', matchPath(room, matchId, 'clue'), {
        round: 1,
        clue: 'Sopa',
      }),
      409,
      'STALE_ROUND',
    );
  });
});

describe('rotation, end and scoring', () => {
  test('every participant is psychic once per cycle in the drawn order, then the match ends', async () => {
    const room = await roomWith(3, { secureRandomInt: fixedTarget(50) });
    let match = await start(room, 2);
    const psychics: string[] = [];
    const spectra: string[] = [];
    for (let round = 1; round <= 6; round++) {
      expect(match).toMatchObject({ phase: 'CLUE', round });
      psychics.push(match.psychicId);
      spectra.push(match.spectrum.id);
      const revealed = await playRound(room, match, 50);
      expect(revealed.phase).toBe('REVEAL');
      match = wavelength(await host(room, revealed, 'next-round'));
    }

    expect(psychics).toEqual([...match.order, ...match.order]);
    expect(new Set(spectra).size).toBe(6);
    expect(match).toMatchObject({ status: 'FINISHED', phase: 'FINISHED' });
    expect(Object.values(match.totals)).toEqual([24, 24, 24]);
    const snapshot = await getRoom(room.harness, room.host, room.code);
    expect(Object.values(scoresOf(snapshot))).toEqual([24, 24, 24]);
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'next-round'), {
        round: 6,
      }),
      409,
      'STALE_ROUND',
    );
    expect(scoresOf(await getRoom(room.harness, room.host, room.code))).toEqual(scoresOf(snapshot));
  });

  test('Jugar otra vez keeps the config and picks spectra not seen that night', async () => {
    const room = await roomWith(3);
    let match = await start(room);
    const seen: string[] = [];
    for (let game = 0; game < 2; game++) {
      while (match.status === 'PLAYING') {
        seen.push(match.spectrum.id);
        match = wavelength(await host(room, await playRound(room, match), 'next-round'));
      }
      match = wavelength(await host(room, match, 'rematch', {}));
      expect(match).toMatchObject({ phase: 'CLUE', round: 1, config: { cycles: 1 } });
    }
    seen.push(match.spectrum.id);

    expect(new Set(seen).size).toBe(7);
    expect((await storedRoom(room))?.usedSpectrumIds).toEqual(seen);
  });
});

describe('a player leaves or is skipped', () => {
  test('a psychic who leaves cancels the round and the next psychic goes', async () => {
    const room = await roomWith(4);
    const match = await giveClue(room, await start(room));
    const [guesser] = guessersOf(room, match);
    if (!guesser) throw new Error('missing guesser');
    await guessed(room, guesser, match, 20);

    await leave(room, match.psychicId);
    const after = wavelength(await getRoom(room.harness, guesser, room.code));

    expect(after).toMatchObject({
      phase: 'CLUE',
      round: 2,
      turn: 1,
      psychicId: match.order[1],
      clue: null,
      committedPlayerIds: [],
      departedIds: [match.psychicId],
      skipped: { round: 1, psychicId: match.psychicId, reason: 'LEFT' },
    });
    expect(after.spectrum.id).not.toBe(match.spectrum.id);
    expect(await secretOf(room, psychicOf(room, after), match.matchId)).toMatchObject({ round: 2 });
    await expectError(guessCall(room, guesser, match, 20), 409, 'STALE_ROUND');
  });

  test('a kicked guesser is dropped and their committed guess discarded', async () => {
    const room = await roomWith(5, { secureRandomInt: fixedTarget(50) });
    const match = await giveClue(room, await start(room));
    const [kicked] = guessersOf(room, match).filter(
      (player) => player.playerId !== room.host.playerId,
    );
    if (!kicked) throw new Error('missing guesser');
    await guessed(room, kicked, match, 50);

    const { room: snapshot } = await json<RoomResponse>(
      call(room.harness, room.host, 'POST', `/api/rooms/${room.code}/kick`, {
        playerId: kicked.playerId,
      }),
    );
    const after = wavelength(snapshot);
    expect(after).toMatchObject({ phase: 'GUESS', departedIds: [kicked.playerId] });
    expect(after.committedPlayerIds).toEqual([]);
    expect(await storedGuesses(room, match.matchId)).toEqual([]);

    let latest = after;
    for (const guesser of guessersOf(room, after))
      latest = await guessed(room, guesser, latest, 50);
    expect(latest.phase).toBe('REVEAL');
    expect(latest.lastResult?.guesses.map((guess) => guess.playerId)).not.toContain(
      kicked.playerId,
    );
  });

  test('a departure that leaves every remaining guesser committed reveals the round', async () => {
    const room = await roomWith(4);
    const match = await giveClue(room, await start(room));
    const [leaver, ...rest] = guessersOf(room, match);
    if (!leaver) throw new Error('missing guesser');
    for (const guesser of rest) await guessed(room, guesser, match, 10);

    await leave(room, leaver.playerId);
    const after = wavelength(
      await getRoom(room.harness, room.players.find((p) => p !== leaver) ?? room.host, room.code),
    );

    expect(after.phase).toBe('REVEAL');
    expect(after.lastResult?.guesses.map((guess) => guess.playerId)).toEqual(
      rest.map((player) => player.playerId),
    );
  });

  test('under 2 players left the match finishes with the points so far', async () => {
    const room = await roomWith(3, { secureRandomInt: fixedTarget(50) });
    const revealed = await playRound(room, await start(room), 50);
    const [stays, ...leavers] = revealed.participants;
    if (!stays) throw new Error('missing player');

    await leave(room, leavers[0] ?? '');
    const two = wavelength(
      await getRoom(
        room.harness,
        room.players.find((p) => p.playerId === stays) ?? room.host,
        room.code,
      ),
    );
    expect(two).toMatchObject({ status: 'PLAYING', phase: 'REVEAL' });
    await leave(room, leavers[1] ?? '');

    const stayer = room.players.find((p) => p.playerId === stays) ?? room.host;
    const snapshot = await getRoom(room.harness, stayer, room.code);
    expect(wavelength(snapshot)).toMatchObject({ status: 'FINISHED', phase: 'FINISHED' });
    expect(scoresOf(snapshot)).toEqual({ [stays]: 4 });
  });

  test('the host skips an absent psychic, who keeps their later turns', async () => {
    const room = await roomWith(3);
    const match = await start(room, 2);
    const notHost = room.players.find((p) => p.playerId !== room.host.playerId) ?? room.host;
    await expectError(
      call(room.harness, notHost, 'POST', matchPath(room, match.matchId, 'skip-psychic'), {
        round: 1,
      }),
      403,
      'NOT_HOST',
    );

    let latest = wavelength(await host(room, match, 'skip-psychic'));
    expect(latest).toMatchObject({
      phase: 'CLUE',
      round: 2,
      turn: 1,
      psychicId: match.order[1],
      departedIds: [],
      skipped: { round: 1, psychicId: match.psychicId, reason: 'SKIPPED' },
    });
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'skip-psychic'), {
        round: 1,
      }),
      409,
      'STALE_ROUND',
    );
    const guessing = await giveClue(room, latest);
    expect(guessing.skipped).toBeNull();
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'skip-psychic'), {
        round: 2,
      }),
      409,
      'STALE_ROUND',
    );

    latest = wavelength(await host(room, guessing, 'close-guessing'));
    latest = wavelength(await host(room, latest, 'next-round'));
    latest = wavelength(await host(room, await playRound(room, latest), 'next-round'));
    expect(latest).toMatchObject({ turn: 3, psychicId: match.psychicId });
  });

  test('a player who leaves and comes back watches as a spectator with no points', async () => {
    const room = await roomWith(4, { secureRandomInt: fixedTarget(50) });
    const match = await giveClue(room, await start(room));
    const leaver = guessersOf(room, match).find((p) => p.playerId !== room.host.playerId);
    if (!leaver) throw new Error('missing guesser');
    await leave(room, leaver.playerId);

    const rejoined = wavelength(await join(room.harness, leaver, room.code));

    expect(rejoined.departedIds).toEqual([leaver.playerId]);
    await expectError(guessCall(room, leaver, rejoined, 50), 422, 'INVALID_GUESS');
    let latest = rejoined;
    while (latest.status === 'PLAYING') {
      const revealed = latest.phase === 'GUESS' ? latest : await giveClue(room, latest);
      let round = revealed;
      for (const guesser of guessersOf(room, revealed))
        round = await guessed(room, guesser, round, 50);
      latest = wavelength(await host(room, round, 'next-round'));
    }
    expect(scoresOf(await getRoom(room.harness, leaver, room.code))[leaver.playerId]).toBe(0);
  });
});
