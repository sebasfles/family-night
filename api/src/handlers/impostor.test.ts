import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  MAX_ROOM_MEMBERS,
  type RoomResponse,
  type WordCategoriesResponse,
} from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import { wordCategories } from '../services/impostor/words.ts';
import { call, expectError, getRoom, join, json, roomWith, updates } from '../test/harness.ts';
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
  test('a selection is provisional and invisible, a confirmed vote shows who voted, never for whom', async () => {
    const { room, match, impostor, civilian, other } = await playing(4);
    room.harness.published.length = 0;

    const selected = await voted(room, civilian, impostor, match, false);
    expect(selected.votedPlayerIds).toEqual([]);
    const changed = await voted(room, civilian, other, match, false);
    expect(changed.votedPlayerIds).toEqual([]);
    expect(updates(room.harness)).toHaveLength(0);

    const confirmed = await voted(room, civilian, other, match);
    expect(confirmed.votedPlayerIds).toEqual([civilian.playerId]);

    const stored = await storedVotes(room, match.matchId);
    expect(stored).toEqual([
      expect.objectContaining({ targetId: other.playerId, confirmed: true }),
    ]);
    expect(JSON.stringify(room.harness.published)).not.toContain('targetId');
    expect(updates(room.harness)).toHaveLength(1);
  });

  test('a confirmed vote cannot change; confirming it again changes nothing', async () => {
    const { room, match, impostor, civilian, other } = await playing(4);
    await voted(room, civilian, impostor, match);
    room.harness.published.length = 0;

    await expectError(vote(room, civilian, other, match), 409, 'VOTE_CONFIRMED');
    await expectError(
      vote(room, civilian, other, match, { confirmed: false }),
      409,
      'VOTE_CONFIRMED',
    );
    await expectError(
      vote(room, civilian, impostor, match, { confirmed: false }),
      409,
      'VOTE_CONFIRMED',
    );
    const again = await voted(room, civilian, impostor, match);

    expect(again.votedPlayerIds).toEqual([civilian.playerId]);
    expect(await storedVotes(room, match.matchId)).toEqual([
      expect.objectContaining({ targetId: impostor.playerId, confirmed: true }),
    ]);
    expect(room.harness.published).toEqual([]);
  });

  test('a confirmed vote is never overwritten by racing requests of the same voter', async () => {
    const { room, match, impostor, civilian, other } = await playing(5);
    const racers = [other, impostor, other, impostor, other];

    const [confirm, ...races] = await Promise.all([
      vote(room, civilian, impostor, match),
      ...racers.map((target) => vote(room, civilian, target, match, { confirmed: false })),
    ]);

    expect(confirm.status).toBe(200);
    const statuses = await Promise.all(
      races.map(async (response) => {
        if (response.status === 200) return 200;
        const { error } = (await response.json()) as { error: { code: string } };
        return error.code;
      }),
    );
    for (const status of statuses) expect([200, 'VOTE_CONFIRMED']).toContain(status);
    expect(await storedVotes(room, match.matchId)).toEqual([
      expect.objectContaining({
        voterId: civilian.playerId,
        targetId: impostor.playerId,
        confirmed: true,
      }),
    ]);
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
    await expectError(vote(room, a, b, match, { round: 2 }), 409, 'STALE_ROUND');
  });

  test('voting closes by itself once every living player confirmed, with the ranking', async () => {
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

  test('a round with every selection made but not all confirmed stays open', async () => {
    const { room, match, impostor, civilian } = await playing(4);
    let latest = match;
    for (const playerId of match.order) {
      const voter = room.players.find((candidate) => candidate.playerId === playerId);
      if (!voter) throw new Error('missing voter');
      const confirmed = voter !== civilian;
      latest = await voted(
        room,
        voter,
        voter === impostor ? civilian : impostor,
        latest,
        confirmed,
      );
    }
    expect(latest.phase).toBe('VOTING');
    expect(latest.votedPlayerIds).toHaveLength(3);
    expect(latest.votedPlayerIds).not.toContain(civilian.playerId);

    const closed = await voted(room, civilian, impostor, latest);
    expect(closed.phase).toBe('REVEAL');
  });

  test('an early close counts unconfirmed selections and missing votes are abstentions', async () => {
    const { room, match, impostor, civilian, other } = await playing(5, { tieRule: 'SKIP' });
    await voted(room, civilian, impostor, match);
    await voted(room, other, impostor, match, false);

    const closed = currentMatch(await hostAction(room, match, 'close-voting', { round: 1 }));

    expect(closed.lastResult?.tally[0]).toEqual({ playerId: impostor.playerId, votes: 2 });
    expect(closed.lastResult?.eliminatedId).toBe(impostor.playerId);
    expect(closed.votedPlayerIds.toSorted()).toEqual(
      [civilian.playerId, other.playerId].toSorted(),
    );
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

  test(`${String(MAX_ROOM_MEMBERS)} simultaneous confirmed votes close the round exactly once`, async () => {
    const room = await roomWith(MAX_ROOM_MEMBERS);
    const match = currentMatch(await start(room));
    room.harness.published.length = 0;
    const [target, fallback] = room.players;
    if (!target || !fallback) throw new Error('missing players');

    const responses = await Promise.all(
      room.players.map((voter) => vote(room, voter, voter === target ? fallback : target, match)),
    );
    expect(await storedVotes(room, match.matchId)).toHaveLength(MAX_ROOM_MEMBERS);

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
  test('impostors win by parity and score civilians over impostors each, once', async () => {
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

  test('voting out the last impostor gives civilians 1 point each, with no last chance', async () => {
    const { room, match, roles, impostor, civilian } = await playing(4);
    const revealed = await everyoneVotes(room, match, impostor, civilian);
    expect(revealed).toMatchObject({
      phase: 'REVEAL',
      lastResult: { eliminatedId: impostor.playerId },
    });

    const finished = await hostAction(room, revealed, 'next-round', { round: 1 });

    expect(currentMatch(finished)).toMatchObject({
      status: 'FINISHED',
      winner: 'CIVILIANS',
      reveal: { word: roles.word, impostorIds: [impostor.playerId] },
    });
    expect(currentMatch(finished)).not.toHaveProperty('guess');
    const scores = scoresOf(finished);
    for (const player of roles.civilians) expect(scores[player.playerId]).toBe(1);
    expect(scores[impostor.playerId]).toBe(0);
  });

  test('an impostor among 5 scores 4, rounded up from the civilians at the start', async () => {
    const { room, match, roles, impostor } = await playing(5);
    let latest = match;
    for (const target of roles.civilians.slice(0, 3)) {
      const revealed = await everyoneVotes(room, latest, target, impostor);
      expect(revealed.lastResult?.eliminatedId).toBe(target.playerId);
      latest = currentMatch(
        await hostAction(room, revealed, 'next-round', { round: revealed.round }),
      );
    }

    expect(latest).toMatchObject({ status: 'FINISHED', winner: 'IMPOSTORS' });
    const scores = scoresOf(await getRoom(room.harness, room.host, room.code));
    expect(scores[impostor.playerId]).toBe(4);
    for (const civilian of roles.civilians) expect(scores[civilian.playerId]).toBe(0);
  });

  test('a voted-out civilian who leaves and returns as a spectator scores nothing', async () => {
    const { room, match, roles, impostor } = await playing(4);
    const [gone, ...stayers] = roles.civilians.filter(
      (civilian) => civilian.playerId !== room.host.playerId,
    );
    if (!gone) throw new Error('missing civilian');
    const out = await everyoneVotes(room, match, gone, impostor);
    expect(out.lastResult?.eliminatedId).toBe(gone.playerId);
    await json(call(room.harness, gone, 'POST', `/api/rooms/${room.code}/leave`));
    expect(currentMatch(await join(room.harness, gone, room.code)).departedIds).toEqual([
      gone.playerId,
    ]);

    const round2 = currentMatch(await hostAction(room, out, 'next-round', { round: 1 }));
    const caught = await everyoneVotes(room, round2, impostor, stayers[0] ?? room.host);
    const finished = await hostAction(room, caught, 'next-round', { round: 2 });

    expect(currentMatch(finished)).toMatchObject({ status: 'FINISHED', winner: 'CIVILIANS' });
    const scores = scoresOf(finished);
    expect(scores[gone.playerId]).toBe(0);
    for (const civilian of roles.civilians.filter((c) => c !== gone)) {
      expect(scores[civilian.playerId]).toBe(1);
    }
  });

  test('the last-chance routes no longer exist', async () => {
    const { room, match, impostor } = await playing(3);
    for (const action of ['guess', 'skip-guess']) {
      await expectError(
        call(room.harness, impostor, 'POST', matchPath(room, match.matchId, action), {
          option: 'Perro',
        }),
        404,
        'NOT_FOUND',
      );
    }
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
