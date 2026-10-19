import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  MANADA_DEFAULTS,
  ONLINE_WINDOW_MS,
  manadaNightPoints,
  type RoomResponse,
  type RoomSnapshot,
} from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import { manadaQuestions } from '../services/manada/questions.ts';
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
  answerCall,
  answered,
  everyoneAnswers,
  hostCall,
  hosted,
  manada,
  secretOf,
  start,
  startCall,
} from '../test/manada.ts';

function scoresOf(room: RoomSnapshot): Record<string, number> {
  return Object.fromEntries(room.members.map((member) => [member.playerId, member.totalScore]));
}

function leave(room: Room, index: number) {
  return json<unknown>(
    call(room.harness, room.member(index), 'POST', `/api/rooms/${room.code}/leave`),
  );
}

function storedRoom(room: Room) {
  return room.harness.client
    .send(new GetCommand({ TableName: room.harness.tables.rooms, Key: { roomCode: room.code } }))
    .then(({ Item }) => Item);
}

async function storedAnswers(room: Room, matchId: string) {
  const { Items } = await room.harness.client.send(
    new QueryCommand({
      TableName: room.harness.tables.matchSecrets,
      KeyConditionExpression: 'matchId = :matchId AND begins_with(playerId, :prefix)',
      ExpressionAttributeValues: { ':matchId': matchId, ':prefix': '#ANSWER#' },
    }),
  );
  return Items ?? [];
}

function idsOf(room: Room, ...indexes: number[]): string[] {
  return indexes.map((index) => room.member(index).playerId);
}

describe('starting La manada', () => {
  test('the host starts with the online members and every phone gets the question', async () => {
    const room = await roomWith(4);
    room.harness.advance(ONLINE_WINDOW_MS);
    for (const index of [0, 1, 2]) {
      await json(call(room.harness, room.member(index), 'POST', `/api/rooms/${room.code}/ping`));
    }
    room.harness.published.length = 0;

    const { room: snapshot } = await json<RoomResponse>(
      startCall(room, { goal: 'POINTS', rounds: 10 }),
      201,
    );
    const match = manada(snapshot);
    expect(match).toMatchObject({
      status: 'PLAYING',
      phase: 'ANSWER',
      round: 1,
      config: { goal: 'POINTS', rounds: 10 },
      participants: idsOf(room, 0, 1, 2),
      answeredPlayerIds: [],
      cowHolderId: null,
      lastResult: null,
    });
    expect(manadaQuestions).toContainEqual(match.question);
    expect(snapshot.selectedGame).toBe('MANADA');
    expect(updates(room.harness)).toEqual([snapshot]);
    expect((await storedRoom(room))?.usedManadaQuestionIds).toEqual([match.question.id]);
  });

  test('a new room carries the default config; bad configs and fewer than 3 cannot start', async () => {
    const room = await roomWith(3);
    expect((await getRoom(room.harness, room.host, room.code)).configs.MANADA).toEqual(
      MANADA_DEFAULTS,
    );
    await expectError(startCall(room, { goal: 'ROUNDS', rounds: 4 }), 422, 'INVALID_CONFIG');
    await expectError(startCall(room, { goal: 'ALL', rounds: 10 }), 422, 'INVALID_CONFIG');
    await expectError(startCall(room, undefined, room.member(1)), 403, 'NOT_HOST');

    room.harness.advance(ONLINE_WINDOW_MS);
    await json(call(room.harness, room.host, 'POST', `/api/rooms/${room.code}/ping`));
    await json(call(room.harness, room.member(1), 'POST', `/api/rooms/${room.code}/ping`));
    const error = await expectError(startCall(room), 422, 'NOT_ENOUGH_PLAYERS');
    expect(error.message).toBe('Se necesitan al menos 3 jugadores en línea');
  });
});

describe('answers', () => {
  test('stay secret until the reveal, are confirmed once and reveal when the last one is in', async () => {
    const room = await roomWith(3);
    const match = await start(room);
    const latecomer = await newPlayer(room.harness);
    await join(room.harness, latecomer, room.code);

    const first = await answered(room, room.member(0), match, '  Pato   Donald ');
    expect(first.answeredPlayerIds).toEqual(idsOf(room, 0));
    expect(await secretOf(room, room.member(0), match.matchId)).toEqual({
      role: 'ANSWERER',
      round: 1,
      answer: 'Pato Donald',
    });
    expect(await secretOf(room, room.member(1), match.matchId)).toEqual({
      role: 'ANSWERER',
      round: 1,
      answer: null,
    });
    expect(await secretOf(room, latecomer, match.matchId)).toBeNull();
    await expectError(answerCall(room, room.member(0), match, 'Mickey'), 409, 'ANSWER_CONFIRMED');
    await expectError(answerCall(room, latecomer, match, 'Mickey'), 403, 'NOT_IN_MATCH');
    await expectError(
      answerCall(room, room.member(1), match, 'uno dos tres cuatro'),
      400,
      'VALIDATION_ERROR',
    );
    await expectError(answerCall(room, room.member(1), match, 'Mickey', 2), 409, 'STALE_ROUND');

    const second = await answered(room, room.member(1), first, 'Mickey');
    const wire = JSON.stringify([room.harness.published, second]);
    expect(wire).not.toContain('Pato Donald');
    expect(wire).not.toContain('Mickey');

    const revealed = await answered(room, room.member(2), second, 'pato donald');
    expect(revealed.phase).toBe('REVEAL');
    expect(revealed.lastResult?.answers).toEqual([
      { playerId: room.member(0).playerId, answer: 'Pato Donald' },
      { playerId: room.member(1).playerId, answer: 'Mickey' },
      { playerId: room.member(2).playerId, answer: 'pato donald' },
    ]);
    expect(revealed.totals).toEqual({
      [room.member(0).playerId]: 1,
      [room.member(1).playerId]: 0,
      [room.member(2).playerId]: 1,
    });
    expect(revealed.cowHolderId).toBe(room.member(1).playerId);
    expect(await secretOf(room, room.member(0), match.matchId)).toBeNull();
  });

  test('simultaneous answers reveal once', async () => {
    const room = await roomWith(8);
    const match = await start(room);
    room.harness.published.length = 0;
    const responses = await Promise.all(
      room.players.map((player, index) =>
        answerCall(room, player, match, index % 2 ? 'Sol' : 'Luna'),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual(room.players.map(() => 200));
    const reveals = updates(room.harness).filter((snapshot) => manada(snapshot).phase === 'REVEAL');
    expect(new Set(reveals.map((snapshot) => snapshot.version)).size).toBe(1);
    const last = await getRoom(room.harness, room.host, room.code);
    expect(manada(last).lastResult?.answers).toHaveLength(8);
    expect(manada(last).totals[room.host.playerId]).toBe(0);
  });

  test('the host closes early, missing answers count as none and a late one never counts', async () => {
    const room = await roomWith(4);
    const match = await start(room);
    const waiting = await everyoneAnswers(room, match, ['Sol', 'sol', 'Luna']);
    await expectError(
      hostCall(room, waiting, 'close-answers', {}, room.member(1)),
      403,
      'NOT_HOST',
    );

    const closed = await hosted(room, waiting, 'close-answers');
    expect(closed.phase).toBe('REVEAL');
    expect(closed.lastResult?.groups.map((group) => group.playerIds)).toEqual([
      idsOf(room, 0, 1),
      idsOf(room, 2),
    ]);
    expect(closed.cowHolderId).toBe(room.member(2).playerId);
    await expectError(answerCall(room, room.member(3), match, 'Sol'), 409, 'STALE_ROUND');
    await expectError(hostCall(room, closed, 'close-answers'), 409, 'STALE_ROUND');
  });
});

describe('merging groups', () => {
  test('the host merges two groups and splits them back, recomputing points and the cow', async () => {
    const room = await roomWith(5);
    const match = await start(room);
    const revealed = await everyoneAnswers(room, match, [
      'Sol',
      'sol',
      'Plátano',
      'Banana',
      'Kiwi',
    ]);
    const [a, b, c, d, e] = idsOf(room, 0, 1, 2, 3, 4);
    if (!a || !b || !c || !d || !e) throw new Error('missing players');
    expect(revealed.totals).toEqual({ [a]: 1, [b]: 1, [c]: 0, [d]: 0, [e]: 0 });
    expect(revealed.cowHolderId).toBeNull();

    await expectError(
      hostCall(room, revealed, 'merge-groups', { groupIds: [c, d] }, room.member(1)),
      403,
      'NOT_HOST',
    );
    const merged = await hosted(room, revealed, 'merge-groups', { groupIds: [c, d] });
    expect(merged.totals).toEqual({ [a]: 0, [b]: 0, [c]: 0, [d]: 0, [e]: 0 });
    expect(merged.cowHolderId).toBe(e);
    const again = await hosted(room, merged, 'merge-groups', { groupIds: [d, c] });
    expect(again.totals).toEqual(merged.totals);

    const chained = await hosted(room, merged, 'merge-groups', { groupIds: [e, c] });
    expect(chained.totals).toEqual({ [a]: 0, [b]: 0, [c]: 1, [d]: 1, [e]: 1 });
    expect(chained.cowHolderId).toBeNull();

    const split = await hosted(room, chained, 'split-group', { groupId: d });
    expect(split.lastResult?.groups).toEqual(revealed.lastResult?.groups);
    expect(split.totals).toEqual(revealed.totals);
    await expectError(
      hostCall(room, split, 'merge-groups', { groupIds: [c, crypto.randomUUID()] }),
      409,
      'TARGET_NOT_MEMBER',
    );
    await expectError(
      hostCall(room, { ...split, round: 2 }, 'split-group', { groupId: c }),
      409,
      'STALE_ROUND',
    );
  });
});

describe('a whole match', () => {
  test('ends when the rounds run out, adds the podium to the night and repeats no question', async () => {
    const room = await roomWith(4);
    let match = await start(room, { goal: 'ROUNDS', rounds: 5 });
    const questions = [match.question.id];
    for (let round = 1; round <= 5; round++) {
      match = await everyoneAnswers(room, match, [
        'Sol',
        'sol',
        round === 5 ? 'sol' : 'Luna',
        'Mar',
      ]);
      match = await hosted(room, match, 'next-round');
      if (match.phase === 'ANSWER') questions.push(match.question.id);
    }
    expect(match).toMatchObject({ status: 'FINISHED', phase: 'FINISHED' });
    expect(new Set(questions).size).toBe(5);

    const [a, b, c, d] = idsOf(room, 0, 1, 2, 3);
    if (!a || !b || !c || !d) throw new Error('missing players');
    expect(match.totals).toEqual({ [a]: 5, [b]: 5, [c]: 1, [d]: 0 });
    expect(match.cowHolderId).toBe(d);
    expect(match.winnerIds).toEqual([a, b]);
    const night = manadaNightPoints(match);
    expect(night).toEqual({ [a]: 4, [b]: 4, [c]: 2, [d]: 1 });
    expect(scoresOf(await getRoom(room.harness, room.host, room.code))).toEqual(night);

    const rematch = manada(
      (
        await json<RoomResponse>(
          call(
            room.harness,
            room.host,
            'POST',
            `/api/rooms/${room.code}/matches/${match.matchId}/rematch`,
          ),
        )
      ).room,
    );
    expect(questions).not.toContain(rematch.question.id);
    expect((await storedRoom(room))?.usedManadaQuestionIds).toHaveLength(6);
  });

  test('until 8 points ends at the end of the first round someone without the cow has 8', async () => {
    const room = await roomWith(3);
    let match = await start(room, { goal: 'POINTS', rounds: 10 });
    for (let round = 1; round <= 8; round++) {
      match = await everyoneAnswers(room, match, ['Sol', 'sol', 'Luna']);
      if (round < 8) match = await hosted(room, match, 'next-round');
    }
    expect(match.phase).toBe('REVEAL');
    const finished = await hosted(room, match, 'next-round');
    expect(finished).toMatchObject({ status: 'FINISHED', winnerIds: idsOf(room, 0, 1) });
  });
});

describe('departures', () => {
  test('a leaver in the answer phase takes their answer out and can complete the round', async () => {
    const room = await roomWith(4);
    const match = await start(room);
    await everyoneAnswers(room, match, ['Sol', 'sol', undefined, 'Luna']);
    expect(await storedAnswers(room, match.matchId)).toHaveLength(3);

    await leave(room, 3);
    expect(await storedAnswers(room, match.matchId)).toHaveLength(2);
    expect(manada(await getRoom(room.harness, room.host, room.code))).toMatchObject({
      phase: 'ANSWER',
      answeredPlayerIds: idsOf(room, 0, 1),
    });

    await leave(room, 2);
    const revealed = manada(await getRoom(room.harness, room.host, room.code));
    expect(revealed.phase).toBe('REVEAL');
    expect(revealed.lastResult?.groups.map((group) => group.playerIds)).toEqual([
      idsOf(room, 0, 1),
    ]);
  });

  test('the match ends with fewer than 2 players and the night gets the podium', async () => {
    const room = await roomWith(3);
    let match = await start(room);
    match = await everyoneAnswers(room, match, ['Sol', 'sol', 'Luna']);
    expect(match.cowHolderId).toBe(room.member(2).playerId);
    await leave(room, 2);
    const afterCow = manada(await getRoom(room.harness, room.host, room.code));
    expect(afterCow.cowHolderId).toBeNull();
    await leave(room, 1);
    const snapshot = await getRoom(room.harness, room.host, room.code);
    expect(manada(snapshot)).toMatchObject({ status: 'FINISHED', winnerIds: idsOf(room, 0) });
    expect(scoresOf(snapshot)).toEqual({ [room.host.playerId]: 1 });
  });
});
