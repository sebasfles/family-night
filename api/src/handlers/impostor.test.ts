import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  MAX_ROOM_MEMBERS,
  type RoomResponse,
  type WordCategoriesResponse,
} from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import { wordCategories } from '../services/impostor/words.ts';
import { call, expectError, getRoom, json, roomWith, updates } from '../test/harness.ts';
import {
  currentMatch,
  everyoneVotes,
  hostAction,
  matchPath,
  rolesOf,
  start,
  vote,
  voted,
  type Room,
} from '../test/impostor.ts';

async function storedVotes(room: Room, matchId: string) {
  const { Items } = await room.harness.client.send(
    new QueryCommand({
      TableName: room.harness.tables.votes,
      KeyConditionExpression: 'matchId = :matchId',
      ExpressionAttributeValues: { ':matchId': matchId },
    }),
  );
  return Items ?? [];
}

async function playing(count: number, overrides = {}) {
  const room = await roomWith(count);
  const match = currentMatch(await start(room, overrides));
  const roles = await rolesOf(room, match);
  const [impostor] = roles.impostors;
  const [civilian, other] = roles.civilians;
  if (!impostor || !civilian || !other) throw new Error('missing roles');
  return { room, match, roles, impostor, civilian, other };
}

function scoresOf(room: RoomResponse['room']): Record<string, number> {
  return Object.fromEntries(room.members.map((member) => [member.playerId, member.totalScore]));
}

describe('voting', () => {
  test('everyone sees who voted, never for whom, and a vote can change', async () => {
    const { room, match, impostor, civilian, other } = await playing(4);
    room.harness.published.length = 0;

    const first = await voted(room, civilian, impostor, match);
    expect(first.votedPlayerIds).toEqual([civilian.playerId]);
    const changed = await voted(room, civilian, other, match);
    expect(changed.votedPlayerIds).toEqual([civilian.playerId]);

    const stored = await storedVotes(room, match.matchId);
    expect(stored).toEqual([expect.objectContaining({ targetId: other.playerId })]);
    expect(JSON.stringify(room.harness.published)).not.toContain('targetId');
    expect(updates(room.harness)).toHaveLength(1);
  });

  test('a vote for oneself, by a spectator or for someone out is refused', async () => {
    const room = await roomWith(4);
    room.harness.advance(60_000);
    for (const player of room.players.slice(0, 3)) {
      await json(call(room.harness, player, 'POST', `/api/rooms/${room.code}/ping`));
    }
    const match = currentMatch(await start(room));
    const [a, b] = room.players;
    const spectator = room.member(3);
    if (!a || !b) throw new Error('missing players');

    await expectError(vote(room, a, a, match), 422, 'INVALID_VOTE');
    await expectError(vote(room, spectator, a, match), 422, 'INVALID_VOTE');
    await expectError(vote(room, a, spectator, match), 422, 'INVALID_VOTE');
    await expectError(vote(room, a, b, match, 2), 409, 'STALE_ROUND');
  });

  test('voting closes by itself once every living player voted, with the ranking', async () => {
    const { room, match, impostor, civilian } = await playing(4);
    room.harness.published.length = 0;

    const revealed = await everyoneVotes(room, match, impostor, civilian);

    expect(revealed.phase).toBe('REVEAL');
    expect(revealed.lastResult).toMatchObject({
      round: 1,
      tie: false,
      eliminatedId: impostor.playerId,
    });
    expect(revealed.lastResult?.tally[0]).toEqual({ playerId: impostor.playerId, votes: 3 });
    expect(revealed.eliminated).toEqual([
      { playerId: impostor.playerId, round: 1, wasImpostor: true, reason: 'VOTE' },
    ]);
    const reveals = updates(room.harness).filter((s) => currentMatch(s).phase === 'REVEAL');
    expect(reveals).toHaveLength(1);
  });

  test('a repeated tap on a closed round answers STALE_ROUND and changes nothing', async () => {
    const { room, match, impostor, civilian } = await playing(4);
    await everyoneVotes(room, match, impostor, civilian);
    const before = await getRoom(room.harness, room.host, room.code);
    room.harness.published.length = 0;

    await expectError(vote(room, civilian, impostor, match), 409, 'STALE_ROUND');
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'close-voting'), {
        round: 1,
      }),
      409,
      'STALE_ROUND',
    );

    expect(await getRoom(room.harness, room.host, room.code)).toEqual(before);
    expect(room.harness.published).toEqual([]);
  });

  test('the host closes voting early and missing votes are abstentions', async () => {
    const { room, match, impostor, civilian } = await playing(4, { tieRule: 'SKIP' });
    await voted(room, civilian, impostor, match);
    await expectError(
      call(
        room.harness,
        civilian === room.host ? impostor : civilian,
        'POST',
        matchPath(room, match.matchId, 'close-voting'),
        { round: 1 },
      ),
      403,
      'NOT_HOST',
    );

    const closed = currentMatch(await hostAction(room, match, 'close-voting', { round: 1 }));

    expect(closed.phase).toBe('REVEAL');
    expect(closed.lastResult?.eliminatedId).toBe(impostor.playerId);
    expect(closed.votedPlayerIds).toEqual([civilian.playerId]);
  });

  test('a tie with SKIP eliminates nobody and the next round clears the votes', async () => {
    const { room, match, impostor, civilian } = await playing(4, { tieRule: 'SKIP' });
    await voted(room, civilian, impostor, match);
    await voted(room, impostor, civilian, match);
    const closed = currentMatch(await hostAction(room, match, 'close-voting', { round: 1 }));
    expect(closed.lastResult).toMatchObject({ tie: true, eliminatedId: null });
    expect(closed.eliminated).toEqual([]);

    const next = currentMatch(await hostAction(room, closed, 'next-round', { round: 1 }));

    expect(next).toMatchObject({ phase: 'VOTING', round: 2, votedPlayerIds: [], lastResult: null });
    expect(await storedVotes(room, match.matchId)).toEqual([]);
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'next-round'), {
        round: 1,
      }),
      409,
      'STALE_ROUND',
    );
  });

  test(`${String(MAX_ROOM_MEMBERS)} simultaneous votes close the round exactly once`, async () => {
    const room = await roomWith(MAX_ROOM_MEMBERS);
    const match = currentMatch(await start(room));
    room.harness.published.length = 0;
    const [target, fallback] = room.players;
    if (!target || !fallback) throw new Error('missing players');

    const responses = await Promise.all(
      room.players.map((voter) => vote(room, voter, voter === target ? fallback : target, match)),
    );

    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(
      responses.map((response) => response.status),
      JSON.stringify(bodies),
    ).toEqual(room.players.map(() => 200));
    const reveals = updates(room.harness).filter((s) => currentMatch(s).phase === 'REVEAL');
    expect(reveals).toHaveLength(1);
    const result = currentMatch(reveals[0] ?? (await getRoom(room.harness, room.host, room.code)));
    expect(result.votedPlayerIds).toHaveLength(MAX_ROOM_MEMBERS);
    expect(result.lastResult?.tally.reduce((sum, entry) => sum + entry.votes, 0)).toBe(
      MAX_ROOM_MEMBERS,
    );
    expect(result.lastResult?.eliminatedId).toBe(target.playerId);
  });
});

describe('end of the match and scoring', () => {
  test('impostors win by parity and score 2 each, once', async () => {
    const { room, match, impostor, civilian, other } = await playing(3);
    await voted(room, impostor, civilian, match);
    await voted(room, other, civilian, match);
    const revealed = await voted(room, civilian, other, match);
    expect(revealed.lastResult?.eliminatedId).toBe(civilian.playerId);

    const finished = await hostAction(room, revealed, 'next-round', { round: 1 });

    expect(currentMatch(finished)).toMatchObject({ status: 'FINISHED', winner: 'IMPOSTORS' });
    expect(scoresOf(finished)).toEqual({
      [impostor.playerId]: 2,
      [civilian.playerId]: 0,
      [other.playerId]: 0,
    });
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'next-round'), {
        round: 1,
      }),
      409,
      'STALE_ROUND',
    );
    expect(scoresOf(await getRoom(room.harness, room.host, room.code))).toEqual(scoresOf(finished));
  });

  test('a caught impostor who guesses right steals the win', async () => {
    const { room, match, roles, impostor, civilian } = await playing(4);
    const revealed = await everyoneVotes(room, match, impostor, civilian);
    const guessing = currentMatch(await hostAction(room, revealed, 'next-round', { round: 1 }));
    expect(guessing.phase).toBe('IMPOSTOR_GUESS');
    expect(guessing.guess?.guesserId).toBe(impostor.playerId);
    expect(guessing.guess?.options).toHaveLength(5);
    expect(guessing.guess?.options).toContain(roles.word);

    await expectError(
      call(room.harness, civilian, 'POST', matchPath(room, match.matchId, 'guess'), {
        option: roles.word,
      }),
      403,
      'NOT_GUESSER',
    );
    const { room: finished } = await json<RoomResponse>(
      call(room.harness, impostor, 'POST', matchPath(room, match.matchId, 'guess'), {
        option: roles.word,
      }),
    );

    expect(currentMatch(finished)).toMatchObject({
      winner: 'IMPOSTORS',
      guess: { chosen: roles.word, correct: true },
      reveal: { word: roles.word, impostorIds: [impostor.playerId] },
    });
    expect(scoresOf(finished)[impostor.playerId]).toBe(2);
  });

  test('a wrong guess gives civilians 1 point each', async () => {
    const { room, match, roles, impostor, civilian } = await playing(4);
    const revealed = await everyoneVotes(room, match, impostor, civilian);
    const guessing = currentMatch(await hostAction(room, revealed, 'next-round', { round: 1 }));
    const wrong = guessing.guess?.options.find((option) => option !== roles.word) ?? '';

    const { room: finished } = await json<RoomResponse>(
      call(room.harness, impostor, 'POST', matchPath(room, match.matchId, 'guess'), {
        option: wrong,
      }),
    );

    expect(currentMatch(finished)).toMatchObject({
      winner: 'CIVILIANS',
      guess: { chosen: wrong, correct: false },
    });
    const scores = scoresOf(finished);
    for (const player of roles.civilians) expect(scores[player.playerId]).toBe(1);
    expect(scores[impostor.playerId]).toBe(0);
  });

  test('the host skips the guess and civilians win; a guess outside the phase is stale', async () => {
    const { room, match, roles, impostor, civilian } = await playing(4);
    await expectError(
      call(room.harness, impostor, 'POST', matchPath(room, match.matchId, 'guess'), {
        option: roles.word,
      }),
      409,
      'STALE_ROUND',
    );
    const revealed = await everyoneVotes(room, match, impostor, civilian);
    const guessing = currentMatch(await hostAction(room, revealed, 'next-round', { round: 1 }));

    const finished = await hostAction(room, guessing, 'skip-guess');

    expect(currentMatch(finished)).toMatchObject({ winner: 'CIVILIANS', guess: { chosen: null } });
    await expectError(
      call(room.harness, room.host, 'POST', matchPath(room, match.matchId, 'skip-guess')),
      409,
      'STALE_ROUND',
    );
  });
});

describe('word categories', () => {
  test('any identified player gets the categories with their word counts', async () => {
    const room = await roomWith(1);
    const body = await json<WordCategoriesResponse>(
      call(room.harness, room.host, 'GET', '/api/words/categories'),
    );
    expect(body.categories).toEqual(wordCategories);
    expect(body.categories).toHaveLength(10);

    const anonymous = await room.harness.app.request('/api/words/categories');
    expect(anonymous.status).toBe(401);
  });
});
