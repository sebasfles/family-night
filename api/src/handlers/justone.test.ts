import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  JUST_ONE_DEFAULTS,
  MAX_ROOM_MEMBERS,
  ONLINE_WINDOW_MS,
  type RoomResponse,
  type RoomSnapshot,
} from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import { justOneWords } from '../services/justone/words.ts';
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
import type { Room } from '../test/impostor.ts';
import {
  act,
  acted,
  clueCall,
  clueGiversOf,
  distinctClue,
  everyoneGivesClues,
  firstClueGiver,
  gaveClue,
  guesserOf,
  host,
  justOne,
  playRound,
  secretOf,
  start,
  startCall,
  toGuess,
  wordOf,
} from '../test/justone.ts';
import { start as startWavelength } from '../test/wavelength.ts';

function scoresOf(room: RoomSnapshot): Record<string, number> {
  return Object.fromEntries(room.members.map((member) => [member.playerId, member.totalScore]));
}

function leave(room: Room, playerId: string) {
  const player = room.players.find((candidate) => candidate.playerId === playerId);
  if (!player) throw new Error('unknown player');
  return json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/leave`));
}

function stayer(room: Room, ...gone: string[]) {
  const player = room.players.find((candidate) => !gone.includes(candidate.playerId));
  if (!player) throw new Error('everyone left');
  return player;
}

async function storedClues(room: Room, matchId: string) {
  const { Items } = await room.harness.client.send(
    new QueryCommand({
      TableName: room.harness.tables.matchSecrets,
      KeyConditionExpression: 'matchId = :matchId AND begins_with(playerId, :prefix)',
      ExpressionAttributeValues: { ':matchId': matchId, ':prefix': '#CLUE#' },
    }),
  );
  return Items ?? [];
}

function storedRoom(room: Room) {
  return room.harness.client
    .send(new GetCommand({ TableName: room.harness.tables.rooms, Key: { roomCode: room.code } }))
    .then(({ Item }) => Item);
}

function wireOf(room: Room, reads: RoomSnapshot[] = []): string {
  return JSON.stringify([room.harness.published, reads]);
}

describe('starting Just One', () => {
  test('the host starts with the online members, one publish, a guesser and no word', async () => {
    const room = await roomWith(4);
    room.harness.advance(ONLINE_WINDOW_MS);
    for (const player of room.players.slice(0, 3)) {
      await json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/ping`));
    }
    room.harness.published.length = 0;

    const { room: snapshot } = await json<RoomResponse>(startCall(room, { cycles: 2 }), 201);
    const match = justOne(snapshot);

    expect(match).toMatchObject({
      status: 'PLAYING',
      phase: 'CLUE',
      round: 1,
      turn: 0,
      config: { cycles: 2 },
      committedPlayerIds: [],
      cancelledAuthorIds: [],
      clues: null,
      score: 0,
      roundsWon: 0,
    });
    const online = room.players.slice(0, 3).map((player) => player.playerId);
    expect(match.participants).toEqual(online);
    expect(match.order.toSorted()).toEqual(online.toSorted());
    expect(match.guesserId).toBe(match.order[0]);
    expect(snapshot).toMatchObject({
      selectedGame: 'JUST_ONE',
      configs: { JUST_ONE: { cycles: 2 } },
    });
    expect(updates(room.harness)).toEqual([snapshot]);
    const word = await wordOf(room, match);
    const picked = justOneWords.find((entry) => entry.word === word);
    expect((await storedRoom(room))?.usedJustOneWordIds).toEqual([picked?.id]);
    expect((await storedRoom(room))?.usedWordIds).toEqual([]);
  });

  test('a new room carries the default config; bad configs and fewer than 3 cannot start', async () => {
    const room = await roomWith(3);
    expect((await getRoom(room.harness, room.host, room.code)).configs.JUST_ONE).toEqual(
      JUST_ONE_DEFAULTS,
    );
    await expectError(startCall(room, { cycles: 4 }), 422, 'INVALID_CONFIG');
    await expectError(startCall(room, { cycles: 1, extra: 1 }), 422, 'INVALID_CONFIG');
    await expectError(startCall(room, { cycles: 1 }, room.member(1)), 403, 'NOT_HOST');
    const config = await json<RoomResponse>(
      call(room.harness, room.host, 'PUT', `/api/rooms/${room.code}/config`, {
        gameType: 'JUST_ONE',
        config: { cycles: 3 },
      }),
    );
    expect(config.room).toMatchObject({
      selectedGame: 'JUST_ONE',
      configs: { JUST_ONE: { cycles: 3 } },
    });

    room.harness.advance(ONLINE_WINDOW_MS);
    await json(call(room.harness, room.host, 'POST', `/api/rooms/${room.code}/ping`));
    await json(call(room.harness, room.member(1), 'POST', `/api/rooms/${room.code}/ping`));
    await expectError(startCall(room), 422, 'NOT_ENOUGH_PLAYERS');
  });
});

describe('secrets', () => {
  test('/me gives the word to the clue-givers of the round only, until the reveal', async () => {
    const room = await roomWith(4);
    const match = await start(room);
    const latecomer = await newPlayer(room.harness);
    await join(room.harness, latecomer, room.code);
    const [first, ...others] = clueGiversOf(room, match);
    if (!first) throw new Error('missing clue-giver');

    const word = await wordOf(room, match);
    expect(justOneWords.map((entry) => entry.word)).toContain(word);
    expect(await secretOf(room, guesserOf(room, match), match.matchId)).toBeNull();
    expect(await secretOf(room, latecomer, match.matchId)).toBeNull();
    expect(await secretOf(room, first, match.matchId)).toEqual({
      role: 'CLUE_GIVER',
      round: 1,
      word,
      clue: null,
      clues: [],
    });

    await gaveClue(room, first, match, 'Pistaa');
    expect(await secretOf(room, first, match.matchId)).toMatchObject({ clue: 'Pistaa', clues: [] });
    expect(await secretOf(room, others[0] ?? first, match.matchId)).toMatchObject({ clue: null });

    let review = match;
    for (const [index, giver] of others.entries()) {
      review = await gaveClue(room, giver, review, distinctClue(index + 1));
    }
    expect(review.phase).toBe('REVIEW');
    expect((await secretOf(room, first, match.matchId))?.clues).toEqual(
      clueGiversOf(room, match).map((giver, index) => ({
        authorId: giver.playerId,
        clue: distinctClue(index),
      })),
    );
    expect(await secretOf(room, guesserOf(room, match), match.matchId)).toBeNull();

    const guessing = await acted(room, first, review, 'show-clues');
    expect(await secretOf(room, first, match.matchId)).toMatchObject({ word });
    expect(await secretOf(room, guesserOf(room, match), match.matchId)).toBeNull();

    await acted(room, guesserOf(room, match), guessing, 'guess', { guess: null });
    expect(await secretOf(room, first, match.matchId)).toBeNull();
  });

  test('a clue stored after the clues closed is not shown to its author as given', async () => {
    const room = await roomWith(4);
    const match = await start(room);
    const [early, late] = clueGiversOf(room, match).filter(
      (giver) => giver.playerId !== room.host.playerId,
    );
    if (!early || !late) throw new Error('missing clue-givers');
    await gaveClue(room, early, match, 'Pistaa');
    const review = await host(room, match, 'close-clues');
    const now = room.harness.now();
    expect(
      await room.harness.deps.repos.matchSecrets.putClue({
        matchId: match.matchId,
        round: match.round,
        authorId: late.playerId,
        clue: 'Tarde',
        createdAt: new Date(now).toISOString(),
        ttl: Math.floor(now / 1000) + 3600,
      }),
    ).toBe(true);

    expect(await secretOf(room, late, match.matchId)).toMatchObject({
      clue: null,
      clues: [{ authorId: early.playerId, clue: 'Pistaa' }],
    });
    expect(await secretOf(room, early, match.matchId)).toMatchObject({ clue: 'Pistaa' });
    const guessing = await acted(room, early, review, 'show-clues');
    expect(await secretOf(room, late, match.matchId)).toMatchObject({ clue: null });
    expect(guessing.clues).toEqual([{ authorId: early.playerId, clue: 'Pistaa' }]);
  });

  test('no snapshot or event carries the word, an uncommitted clue or a cancelled one', async () => {
    const room = await roomWith(5);
    room.harness.published.length = 0;
    const match = await start(room);
    const word = await wordOf(room, match);
    const [a, b, c, d] = clueGiversOf(room, match);
    if (!a || !b || !c || !d) throw new Error('missing clue-givers');

    let latest = await gaveClue(room, a, match, 'Zorrillo');
    latest = await gaveClue(room, b, latest, 'Pistamia');
    const reads = await Promise.all(room.players.map((p) => getRoom(room.harness, p, room.code)));
    latest = await gaveClue(room, c, latest, 'pistamías');
    latest = await gaveClue(room, d, latest, 'Tortuguita');
    expect(latest.cancelledAuthorIds.toSorted()).toEqual([b.playerId, c.playerId].toSorted());
    latest = await acted(room, a, latest, 'cancel-clue', { authorId: d.playerId, cancelled: true });
    reads.push(
      ...(await Promise.all(room.players.map((p) => getRoom(room.harness, p, room.code)))),
    );

    const hidden = wireOf(room, reads);
    for (const text of [word, 'Zorrillo', 'Pistamia', 'pistamías', 'Tortuguita']) {
      expect(hidden).not.toContain(`"${text}"`);
    }
    expect(hidden).not.toContain('"word"');
    expect(hidden).not.toContain('CLUE_GIVER');
    expect(hidden).not.toContain('#ROUND');
    expect(hidden).not.toContain('#CLUE');

    room.harness.published.length = 0;
    const guessing = await acted(room, a, latest, 'show-clues');
    expect(guessing.clues).toEqual([{ authorId: a.playerId, clue: 'Zorrillo' }]);
    const shown = wireOf(room, [await getRoom(room.harness, a, room.code)]);
    expect(shown).toContain('"Zorrillo"');
    for (const text of [word, 'Pistamia', 'pistamías', 'Tortuguita']) {
      expect(shown).not.toContain(`"${text}"`);
    }

    const revealed = await acted(room, guesserOf(room, match), guessing, 'guess', { guess: null });
    expect(revealed.lastResult?.word).toBe(word);
    expect(revealed.lastResult?.clues.map((clue) => [clue.clue, clue.cancelled])).toEqual(
      expect.arrayContaining([
        ['Zorrillo', false],
        ['Pistamia', true],
        ['pistamías', true],
        ['Tortuguita', true],
      ]),
    );
  });
});

describe('clues', () => {
  test('only clue-givers commit, once, one word of up to 30 characters', async () => {
    const room = await roomWith(4);
    room.harness.advance(ONLINE_WINDOW_MS);
    for (const player of room.players.slice(0, 3)) {
      await json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/ping`));
    }
    const match = await start(room);
    const giver = firstClueGiver(room, match);
    const spectator = room.member(3);

    await expectError(clueCall(room, guesserOf(room, match), match, 'Hola'), 403, 'NOT_CLUE_GIVER');
    await expectError(clueCall(room, spectator, match, 'Hola'), 403, 'NOT_CLUE_GIVER');
    for (const bad of ['dos palabras', 'x'.repeat(31), '   ', '¡!', '']) {
      await expectError(clueCall(room, giver, match, bad), 400, 'VALIDATION_ERROR');
    }
    await expectError(clueCall(room, giver, match, 'Hola', 2), 409, 'STALE_ROUND');

    const committed = await gaveClue(room, giver, match, `  ${'y'.repeat(30)} `);
    expect(committed).toMatchObject({ phase: 'CLUE', committedPlayerIds: [giver.playerId] });
    room.harness.published.length = 0;
    await expectError(clueCall(room, giver, match, 'Otra'), 409, 'STALE_ROUND');
    expect(room.harness.published).toEqual([]);
    expect((await secretOf(room, giver, match.matchId))?.clue).toBe('y'.repeat(30));
  });

  test('the last commit opens the review once, with duplicates and the word cancelled', async () => {
    const room = await roomWith(5);
    const match = await start(room);
    const word = await wordOf(room, match);
    room.harness.published.length = 0;

    const review = await everyoneGivesClues(room, match, [
      'Hueso',
      'HUESOS',
      word.toUpperCase(),
      'Correa',
    ]);

    const givers = clueGiversOf(room, match).map((giver) => giver.playerId);
    expect(review).toMatchObject({
      phase: 'REVIEW',
      committedPlayerIds: givers,
      cancelledAuthorIds: givers.slice(0, 3),
    });
    const reviews = updates(room.harness).filter((s) => justOne(s).phase === 'REVIEW');
    expect(reviews).toHaveLength(1);
  });

  test(`${String(MAX_ROOM_MEMBERS - 1)} simultaneous clues open the review exactly once`, async () => {
    const room = await roomWith(MAX_ROOM_MEMBERS);
    const match = await start(room);
    const word = await wordOf(room, match);
    const givers = clueGiversOf(room, match);
    room.harness.published.length = 0;

    const responses = await Promise.all(
      givers.map((giver, index) => clueCall(room, giver, match, distinctClue(index))),
    );

    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(
      responses.map((response) => response.status),
      JSON.stringify(bodies),
    ).toEqual(givers.map(() => 200));
    const reviews = updates(room.harness).filter((s) => justOne(s).phase === 'REVIEW');
    expect(reviews).toHaveLength(1);
    expect(
      justOne(reviews[0] ?? (await getRoom(room.harness, room.host, room.code))),
    ).toMatchObject({
      committedPlayerIds: givers.map((giver) => giver.playerId),
      cancelledAuthorIds: [],
    });
    const wire = wireOf(room, [await getRoom(room.harness, room.host, room.code)]);
    expect(wire).not.toContain(`"${word}"`);
    for (const index of givers.keys()) expect(wire).not.toContain(`"${distinctClue(index)}"`);
  });

  test('the host closes the clues early and missing clues count as none', async () => {
    const room = await roomWith(4);
    const match = await start(room);
    const [early, late] = clueGiversOf(room, match);
    if (!early || !late) throw new Error('missing clue-givers');
    await gaveClue(room, early, match, 'Pistaa');
    const notHost = stayer(room, room.host.playerId);
    await expectError(act(room, notHost, match, 'close-clues'), 403, 'NOT_HOST');

    const review = await host(room, match, 'close-clues');

    expect(review).toMatchObject({ phase: 'REVIEW', committedPlayerIds: [early.playerId] });
    await expectError(act(room, room.host, match, 'close-clues'), 409, 'STALE_ROUND');
    await expectError(clueCall(room, late, match, 'Tarde'), 409, 'STALE_ROUND');
    const guessing = await acted(room, early, review, 'show-clues');
    expect(guessing.clues).toEqual([{ authorId: early.playerId, clue: 'Pistaa' }]);
  });
});

describe('review', () => {
  test('clue-givers set a clue cancelled or not; repeating changes nothing', async () => {
    const room = await roomWith(4);
    const review = await everyoneGivesClues(room, await start(room));
    const [a, b] = clueGiversOf(room, review);
    if (!a || !b) throw new Error('missing clue-givers');
    const cancel = (player = a, authorId = b.playerId, cancelled = true, round = review.round) =>
      act(room, player, review, 'cancel-clue', { authorId, cancelled, round });

    const cancelled = justOne((await json<RoomResponse>(cancel())).room);
    expect(cancelled.cancelledAuthorIds).toEqual([b.playerId]);
    room.harness.published.length = 0;
    const again = justOne((await json<RoomResponse>(cancel())).room);
    expect(again).toEqual(cancelled);
    expect(room.harness.published).toEqual([]);
    const restored = justOne((await json<RoomResponse>(cancel(b, b.playerId, false))).room);
    expect(restored.cancelledAuthorIds).toEqual([]);

    await expectError(cancel(guesserOf(room, review)), 403, 'NOT_CLUE_GIVER');
    await expectError(cancel(a, guesserOf(room, review).playerId), 409, 'TARGET_NOT_MEMBER');
    await expectError(cancel(a, b.playerId, true, 2), 409, 'STALE_ROUND');
    await expectError(
      act(room, a, review, 'cancel-clue', { authorId: b.playerId }),
      400,
      'VALIDATION_ERROR',
    );
  });

  test('a clue-giver or the host shows the clues; the guesser alone cannot', async () => {
    const room = await roomWith(3);
    let match = await start(room);
    while (match.guesserId === room.host.playerId) {
      match = await host(room, await playRound(room, match, 'PASS'), 'next-round');
    }
    const review = await everyoneGivesClues(room, match);
    await expectError(
      act(room, guesserOf(room, review), review, 'show-clues'),
      403,
      'NOT_CLUE_GIVER',
    );
    const guessing = await host(room, review, 'show-clues');
    expect(guessing.phase).toBe('GUESS');
    await expectError(act(room, room.host, review, 'show-clues'), 409, 'STALE_ROUND');
  });

  test('the host shows the clues also when the host is the guesser', async () => {
    const room = await roomWith(3);
    let match = await start(room);
    while (match.guesserId !== room.host.playerId) {
      match = await host(room, await playRound(room, match, 'PASS'), 'next-round');
    }
    const review = await everyoneGivesClues(room, match);
    expect((await host(room, review, 'show-clues')).phase).toBe('GUESS');
  });
});

describe('guess and score', () => {
  test('the guesser guesses once, checked by normalization', async () => {
    const room = await roomWith(4);
    const match = await start(room);
    const word = await wordOf(room, match);
    const guessing = await toGuess(room, match);
    const guesser = guesserOf(room, guessing);
    const guess = (player = guesser, body: Record<string, unknown> = { guess: word }) =>
      act(room, player, guessing, 'guess', body);

    await expectError(guess(firstClueGiver(room, guessing)), 422, 'INVALID_GUESS');
    await expectError(guess(guesser, {}), 400, 'VALIDATION_ERROR');
    await expectError(guess(guesser, { guess: '  ' }), 400, 'VALIDATION_ERROR');
    await expectError(guess(guesser, { guess: word, round: 2 }), 409, 'STALE_ROUND');

    const loose = ` ${word.toUpperCase().normalize('NFD').replace(/\p{M}/gu, '')}s `;
    const revealed = justOne((await json<RoomResponse>(guess(guesser, { guess: loose }))).room);
    expect(revealed).toMatchObject({ phase: 'REVEAL', score: 1, roundsWon: 1 });
    expect(revealed.lastResult).toMatchObject({
      guesserId: guesser.playerId,
      word,
      guess: loose.trim(),
      outcome: 'CORRECT',
      accepted: false,
      scoreBefore: 0,
      score: 1,
    });
    await expectError(guess(), 409, 'STALE_ROUND');
  });

  test('a pass scores 0, a wrong guess -1 with a floor of 0, and the host can count it', async () => {
    const room = await roomWith(3);
    let match = await start(room, 3);
    match = await playRound(room, match, 'PASS');
    expect(match).toMatchObject({ score: 0, lastResult: { outcome: 'PASS', score: 0 } });
    await expectError(act(room, room.host, match, 'accept-guess'), 409, 'STALE_ROUND');

    match = await playRound(room, await host(room, match, 'next-round'), 'WRONG');
    expect(match).toMatchObject({ score: 0, lastResult: { outcome: 'WRONG' } });
    match = await playRound(room, await host(room, match, 'next-round'), 'CORRECT');
    match = await playRound(room, await host(room, match, 'next-round'), 'CORRECT');
    expect(match.score).toBe(2);
    match = await playRound(room, await host(room, match, 'next-round'), 'WRONG');
    expect(match).toMatchObject({ score: 1, roundsWon: 2 });

    await expectError(
      act(room, stayer(room, room.host.playerId), match, 'accept-guess'),
      403,
      'NOT_HOST',
    );
    const accepted = await host(room, match, 'accept-guess');
    expect(accepted).toMatchObject({
      score: 3,
      roundsWon: 3,
      lastResult: { outcome: 'CORRECT', accepted: true, scoreBefore: 2, score: 3 },
    });
    await expectError(act(room, room.host, match, 'accept-guess'), 409, 'STALE_ROUND');
  });

  test('a command of the other game answers STALE_ROUND', async () => {
    const room = await roomWith(3);
    const wavelength = await startWavelength(room);
    await expectError(act(room, room.host, wavelength, 'close-clues'), 409, 'STALE_ROUND');
    await expectError(
      act(room, room.host, wavelength, 'guess', { guess: 'Perro' }),
      400,
      'VALIDATION_ERROR',
    );
  });
});

describe('rotation, end and scoring', () => {
  test('every participant guesses once per cycle in order, then everyone gets the team score', async () => {
    const room = await roomWith(3);
    let match = await start(room, 2);
    const guessers: string[] = [];
    const words: string[] = [];
    for (let round = 1; round <= 6; round++) {
      expect(match).toMatchObject({ phase: 'CLUE', round });
      guessers.push(match.guesserId);
      const revealed = await playRound(room, match, round === 6 ? 'WRONG' : 'CORRECT');
      words.push(revealed.lastResult?.word ?? '');
      match = await host(room, revealed, 'next-round');
    }

    expect(guessers).toEqual([...match.order, ...match.order]);
    expect(new Set(words).size).toBe(6);
    expect(match).toMatchObject({ status: 'FINISHED', phase: 'FINISHED', score: 4, roundsWon: 5 });
    const snapshot = await getRoom(room.harness, room.host, room.code);
    expect(Object.values(scoresOf(snapshot))).toEqual([4, 4, 4]);
    await expectError(act(room, room.host, match, 'next-round'), 409, 'STALE_ROUND');
    expect(scoresOf(await getRoom(room.harness, room.host, room.code))).toEqual(scoresOf(snapshot));
  });

  test('Jugar otra vez keeps the config and picks words not seen that night', async () => {
    const room = await roomWith(3);
    let match = await start(room);
    const seen: string[] = [];
    for (let game = 0; game < 2; game++) {
      while (match.status === 'PLAYING') {
        const revealed = await playRound(room, match, 'PASS');
        seen.push(revealed.lastResult?.word ?? '');
        match = await host(room, revealed, 'next-round');
      }
      match = await host(room, match, 'rematch');
      expect(match).toMatchObject({ phase: 'CLUE', round: 1, config: { cycles: 1 } });
    }
    seen.push(await wordOf(room, match));

    expect(new Set(seen).size).toBe(7);
    const ids = seen.map((word) => justOneWords.find((entry) => entry.word === word)?.id);
    expect((await storedRoom(room))?.usedJustOneWordIds).toEqual(ids);
  });

  test('the word bank restarts when every word was used', async () => {
    const room = await roomWith(3);
    const [unseen, ...used] = justOneWords;
    if (!unseen) throw new Error('empty bank');
    await room.harness.client.send(
      new UpdateCommand({
        TableName: room.harness.tables.rooms,
        Key: { roomCode: room.code },
        UpdateExpression: 'SET usedJustOneWordIds = :used',
        ExpressionAttributeValues: { ':used': used.map((entry) => entry.id) },
      }),
    );

    const match = await start(room);
    expect(await wordOf(room, match)).toBe(unseen.word);
    const next = await host(room, await playRound(room, match, 'PASS'), 'next-round');
    const word = await wordOf(room, next);
    const id = justOneWords.find((entry) => entry.word === word)?.id;
    expect((await storedRoom(room))?.usedJustOneWordIds).toEqual([id]);
  });
});

describe('a player leaves or is skipped', () => {
  test('a guesser who leaves cancels the round and the next guesser goes', async () => {
    const room = await roomWith(4);
    const match = await start(room);
    const giver = firstClueGiver(room, match);
    await gaveClue(room, giver, match, 'Pistaa');

    await leave(room, match.guesserId);
    const after = justOne(await getRoom(room.harness, giver, room.code));

    expect(after).toMatchObject({
      phase: 'CLUE',
      round: 2,
      turn: 1,
      guesserId: match.order[1],
      committedPlayerIds: [],
      departedIds: [match.guesserId],
      skipped: { round: 1, guesserId: match.guesserId, reason: 'LEFT' },
    });
    await expectError(clueCall(room, giver, match, 'Otra'), 409, 'STALE_ROUND');
    const [first, ...rest] = clueGiversOf(room, after);
    if (!first) throw new Error('missing clue-giver');
    let next = await gaveClue(room, first, after, 'Pistab');
    expect(next.skipped).toEqual(after.skipped);
    for (const [index, giver] of rest.entries()) {
      next = await gaveClue(room, giver, next, distinctClue(index + 2));
    }
    expect(next).toMatchObject({ phase: 'REVIEW', skipped: null });
  });

  test('a guesser who leaves in the reveal changes nothing but the departure', async () => {
    const room = await roomWith(4);
    const revealed = await playRound(room, await start(room), 'CORRECT');
    await leave(room, revealed.guesserId);
    const after = justOne(await getRoom(room.harness, stayer(room, revealed.guesserId), room.code));
    expect(after).toEqual({ ...revealed, departedIds: [revealed.guesserId] });
  });

  test('a clue-giver who leaves in the clue phase is dropped with their clue', async () => {
    const room = await roomWith(5);
    const match = await start(room);
    const [leaver, other] = clueGiversOf(room, match).filter(
      (giver) => giver.playerId !== room.host.playerId,
    );
    if (!leaver || !other) throw new Error('missing clue-givers');
    await gaveClue(room, leaver, match, 'Pistaa');
    await gaveClue(room, other, match, 'Pistab');

    await leave(room, leaver.playerId);
    const after = justOne(await getRoom(room.harness, room.host, room.code));

    expect(after).toMatchObject({
      phase: 'CLUE',
      departedIds: [leaver.playerId],
      committedPlayerIds: [other.playerId],
    });
    const stored = await storedClues(room, match.matchId);
    expect(stored.map((item) => item.authorId as string)).toEqual([other.playerId]);
  });

  test('a departure that leaves every remaining clue-giver committed opens the review', async () => {
    const room = await roomWith(4);
    const match = await start(room);
    const givers = clueGiversOf(room, match);
    const leaver = givers.find((giver) => giver.playerId !== room.host.playerId);
    if (!leaver) throw new Error('missing clue-giver');
    const others = givers.filter((giver) => giver !== leaver);
    for (const [index, giver] of others.entries()) {
      await gaveClue(room, giver, match, distinctClue(index));
    }

    await leave(room, leaver.playerId);
    const after = justOne(await getRoom(room.harness, room.host, room.code));

    expect(after).toMatchObject({
      phase: 'REVIEW',
      committedPlayerIds: others.map((giver) => giver.playerId),
    });
  });

  test('a clue-giver who leaves in review takes their clue out; in guess it stays', async () => {
    const room = await roomWith(5);
    const match = await start(room);
    const review = await everyoneGivesClues(room, match, ['Hueso', 'huesos', 'Pistac', 'Pistad']);
    const [a, b, c, d] = clueGiversOf(room, match);
    if (!a || !b || !c || !d) throw new Error('missing clue-givers');
    expect(review.cancelledAuthorIds).toEqual([a.playerId, b.playerId]);
    const kicker = room.host;
    const kicked = [a, b, c, d].find((giver) => giver.playerId !== kicker.playerId) ?? a;

    await json(
      call(room.harness, kicker, 'POST', `/api/rooms/${room.code}/kick`, {
        playerId: kicked.playerId,
      }),
    );
    const afterKick = justOne(await getRoom(room.harness, kicker, room.code));
    expect(afterKick.committedPlayerIds).not.toContain(kicked.playerId);
    expect(afterKick.cancelledAuthorIds).not.toContain(kicked.playerId);
    const remaining = [a, b, c, d].filter((giver) => giver !== kicked);
    const shower = remaining[0] ?? a;
    const guessing = await acted(room, shower, afterKick, 'show-clues');
    const shownIds = guessing.clues?.map((clue) => clue.authorId) ?? [];
    expect(shownIds).not.toContain(kicked.playerId);

    const goner = remaining.find(
      (giver) => shownIds.includes(giver.playerId) && giver.playerId !== kicker.playerId,
    );
    if (!goner) throw new Error('no clue-giver with a shown clue');
    await leave(room, goner.playerId);
    const afterLeave = justOne(await getRoom(room.harness, kicker, room.code));
    expect(afterLeave.clues).toEqual(guessing.clues);
    const revealed = await acted(room, guesserOf(room, afterLeave), afterLeave, 'guess', {
      guess: null,
    });
    expect(revealed.lastResult?.clues.map((clue) => clue.authorId)).toContain(goner.playerId);
  });

  test('under 2 players left the match finishes with the score so far', async () => {
    const room = await roomWith(3);
    const revealed = await playRound(room, await start(room), 'CORRECT');
    const [stays, ...leavers] = revealed.participants;
    if (!stays) throw new Error('missing player');

    await leave(room, leavers[0] ?? '');
    const two = justOne(await getRoom(room.harness, stayer(room, ...leavers), room.code));
    expect(two).toMatchObject({ status: 'PLAYING', phase: 'REVEAL' });
    await leave(room, leavers[1] ?? '');

    const snapshot = await getRoom(room.harness, stayer(room, ...leavers), room.code);
    expect(justOne(snapshot)).toMatchObject({ status: 'FINISHED', phase: 'FINISHED', score: 1 });
    expect(scoresOf(snapshot)).toEqual({ [stays]: 1 });
  });

  test('the host skips the guesser, who keeps their later turns', async () => {
    const room = await roomWith(3);
    const match = await start(room, 2);
    await expectError(
      act(room, stayer(room, room.host.playerId), match, 'skip-guesser'),
      403,
      'NOT_HOST',
    );
    const review = await everyoneGivesClues(room, match);

    let latest = await host(room, review, 'skip-guesser');
    expect(latest).toMatchObject({
      phase: 'CLUE',
      round: 2,
      turn: 1,
      guesserId: match.order[1],
      departedIds: [],
      skipped: { round: 1, guesserId: match.guesserId, reason: 'SKIPPED' },
    });
    await expectError(act(room, room.host, review, 'skip-guesser'), 409, 'STALE_ROUND');
    const guessing = await toGuess(room, latest);
    latest = await host(room, guessing, 'skip-guesser');
    expect(latest).toMatchObject({ round: 3, turn: 2 });
    latest = await host(room, await playRound(room, latest, 'PASS'), 'next-round');
    expect(latest).toMatchObject({ turn: 3, guesserId: match.guesserId });
    const revealed = await playRound(room, latest, 'PASS');
    await expectError(act(room, room.host, revealed, 'skip-guesser'), 409, 'STALE_ROUND');
  });

  test('a player who leaves and comes back watches as a spectator with nothing secret', async () => {
    const room = await roomWith(4);
    const match = await start(room);
    const leaver = clueGiversOf(room, match).find((p) => p.playerId !== room.host.playerId);
    if (!leaver) throw new Error('missing clue-giver');
    await leave(room, leaver.playerId);

    const rejoined = justOne(await join(room.harness, leaver, room.code));

    expect(rejoined.departedIds).toEqual([leaver.playerId]);
    expect(await secretOf(room, leaver, match.matchId)).toBeNull();
    await expectError(clueCall(room, leaver, rejoined, 'Hola'), 403, 'NOT_CLUE_GIVER');
    let latest = rejoined;
    while (latest.status === 'PLAYING') {
      latest = await host(room, await playRound(room, latest, 'CORRECT'), 'next-round');
    }
    const scores = scoresOf(await getRoom(room.harness, leaver, room.code));
    expect(scores[leaver.playerId]).toBe(0);
    expect(scores[room.host.playerId]).toBe(latest.score);
  });
});
