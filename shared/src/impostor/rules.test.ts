import { describe, expect, test } from 'vitest';
import { IMPOSTOR_DEFAULTS } from '../constants.ts';
import { impostorConfigSchema, type ImpostorConfig, type ImpostorPublic } from '../domain.ts';
import {
  closeVoting,
  everyoneVoted,
  guessOptions,
  maxImpostors,
  nextRound,
  outcome,
  pickWord,
  recordBallots,
  removePlayer,
  matchScores,
  skipGuess,
  startMatch,
  startProblem,
  submitGuess,
  voteProblem,
  type Ballot,
  type MatchFacts,
  type RandomInt,
} from './rules.ts';

function seeded(seed: number): RandomInt {
  let state = seed >>> 0;
  return (max) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

const first: RandomInt = () => 0;
const last: RandomInt = (max) => max - 1;

function config(overrides: Partial<ImpostorConfig> = {}): ImpostorConfig {
  return { ...IMPOSTOR_DEFAULTS, categories: ['animales'], ...overrides };
}

function match(
  players: string[],
  impostorIds: string[],
  overrides: Partial<ImpostorConfig> = {},
): { state: ImpostorPublic; facts: MatchFacts } {
  const { state } = startMatch({
    matchId: 'M1',
    config: config({ impostorCount: impostorIds.length, randomOrder: false, ...overrides }),
    participants: players,
    randomInt: first,
  });
  return {
    state,
    facts: {
      word: 'Perro',
      category: 'Animales',
      options: ['Gato', 'Perro', 'Loro', 'Vaca', 'Pato'],
      impostorIds,
    },
  };
}

function votes(pairs: Record<string, string>): Ballot[] {
  return Object.entries(pairs).map(([voterId, targetId]) => ({ voterId, targetId }));
}

function vote(
  state: ImpostorPublic,
  facts: MatchFacts,
  pairs: Record<string, string>,
  randomInt: RandomInt = first,
) {
  return closeVoting(state, votes(pairs), facts.impostorIds, randomInt);
}

describe('impostor table', () => {
  test.each([
    [2, 0],
    [3, 1],
    [5, 1],
    [6, 2],
    [8, 2],
    [9, 3],
    [20, 3],
  ])('%i players allow %i impostors', (players, impostors) => {
    expect(maxImpostors(players)).toBe(impostors);
  });

  test('a start needs 3 players and impostors within the cap', () => {
    expect(startProblem(config(), 2)).toBe('NOT_ENOUGH_PLAYERS');
    expect(startProblem(config({ impostorCount: 2 }), 5)).toBe('TOO_MANY_IMPOSTORS');
    expect(startProblem(config({ impostorCount: 2 }), 6)).toBeNull();
  });

  test('the config schema refuses no category, repeated categories and out of range counts', () => {
    expect(impostorConfigSchema.safeParse(config()).success).toBe(true);
    expect(impostorConfigSchema.safeParse(config({ categories: [] })).success).toBe(false);
    expect(impostorConfigSchema.safeParse(config({ categories: ['a', 'a'] })).success).toBe(false);
    expect(impostorConfigSchema.safeParse(config({ impostorCount: 0 })).success).toBe(false);
    expect(impostorConfigSchema.safeParse(config({ impostorCount: 1.5 })).success).toBe(false);
  });
});

describe('preparation', () => {
  const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

  test('roles and order are a function of the random source', () => {
    const run = (seed: number) =>
      startMatch({
        matchId: 'M1',
        config: config({ impostorCount: 3 }),
        participants: players,
        randomInt: seeded(seed),
      });

    const one = run(7);
    expect(run(7)).toEqual(one);
    expect(one.impostorIds).toHaveLength(3);
    expect(new Set(one.impostorIds).size).toBe(3);
    expect(one.state.order.toSorted()).toEqual(players);

    const draws = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => run(seed).impostorIds.join()));
    expect(draws.size).toBeGreaterThan(1);
  });

  test('without random order the turn follows arrival, and anyone may be impostor and first', () => {
    const { state, impostorIds } = startMatch({
      matchId: 'M1',
      config: config({ randomOrder: false }),
      participants: players,
      randomInt: last,
    });
    expect(state.order).toEqual(players);
    expect(impostorIds).toEqual(['a']);
  });

  test('the initial public state is round 1 of voting with nobody out', () => {
    const { state } = startMatch({
      matchId: 'M1',
      config: config(),
      participants: players,
      randomInt: first,
    });
    expect(state).toMatchObject({
      status: 'PLAYING',
      phase: 'VOTING',
      round: 1,
      participants: players,
      eliminated: [],
      votedPlayerIds: [],
      winner: null,
      reveal: null,
    });
  });

  const bank = [
    { id: 'animales.perro', category: 'animales' },
    { id: 'animales.gato', category: 'animales' },
    { id: 'comida.palta', category: 'comida' },
  ];

  test('a word is picked outside the used ids of the active categories', () => {
    const picked = pickWord(bank, ['animales.perro'], ['animales'], first);
    expect(picked.word.id).toBe('animales.gato');
    expect(picked.usedWordIds).toEqual(['animales.perro', 'animales.gato']);
  });

  test('an exhausted pool resets only the active categories', () => {
    const used = ['animales.perro', 'animales.gato', 'comida.palta'];
    const picked = pickWord(bank, used, ['animales'], last);
    expect(picked.word.id).toBe('animales.gato');
    expect(picked.usedWordIds).toEqual(['comida.palta', 'animales.gato']);
  });

  test('the guess options are the word and four distinct words of its category', () => {
    const category = ['Perro', 'Gato', 'Loro', 'Vaca', 'Pato', 'Puma', 'Oso'];
    for (const seed of [1, 2, 3, 4, 5]) {
      const options = guessOptions('Perro', category, seeded(seed));
      expect(options).toHaveLength(5);
      expect(new Set(options).size).toBe(5);
      expect(options).toContain('Perro');
      expect(options.every((option) => category.includes(option))).toBe(true);
    }
  });
});

describe('voting', () => {
  test('only a living player votes, for another living player, in the open round', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a']);
    expect(voteProblem(state, 'a', 'b', 1)).toBeNull();
    expect(voteProblem(state, 'a', 'a', 1)).toBe('INVALID_VOTE');
    expect(voteProblem(state, 'z', 'b', 1)).toBe('INVALID_VOTE');
    expect(voteProblem(state, 'a', 'b', 2)).toBe('STALE_ROUND');

    const after = vote(state, facts, { a: 'b', c: 'b', d: 'b' });
    expect(voteProblem(after, 'a', 'c', 1)).toBe('STALE_ROUND');
    const round2 = nextRound(after, facts);
    expect(voteProblem(round2, 'b', 'a', 2)).toBe('INVALID_VOTE');
    expect(voteProblem(round2, 'a', 'b', 2)).toBe('INVALID_VOTE');
  });

  test('voters are listed in turn order and the round is complete when all living voted', () => {
    const { state } = match(['a', 'b', 'c'], ['a']);
    const partial = recordBallots(state, votes({ c: 'a', a: 'b' }));
    expect(partial.votedPlayerIds).toEqual(['a', 'c']);
    expect(everyoneVoted(partial)).toBe(false);
    expect(everyoneVoted(recordBallots(state, votes({ c: 'a', a: 'b', b: 'a' })))).toBe(true);
  });

  test('a single most voted player is out and the tally ranks everyone', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a']);
    const after = vote(state, facts, { a: 'b', b: 'c', c: 'b', d: 'b' });

    expect(after.phase).toBe('REVEAL');
    expect(after.lastResult).toEqual({
      round: 1,
      tally: [
        { playerId: 'b', votes: 3 },
        { playerId: 'c', votes: 1 },
        { playerId: 'a', votes: 0 },
        { playerId: 'd', votes: 0 },
      ],
      tie: false,
      eliminatedId: 'b',
    });
    expect(after.eliminated).toEqual([
      { playerId: 'b', round: 1, wasImpostor: false, reason: 'VOTE' },
    ]);
    expect(after.order).toEqual(['a', 'c', 'd']);
  });

  test('a tie with SKIP eliminates nobody', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a'], { tieRule: 'SKIP' });
    const after = vote(state, facts, { a: 'b', b: 'a', c: 'a', d: 'b' });
    expect(after.lastResult).toMatchObject({ tie: true, eliminatedId: null });
    expect(after.eliminated).toEqual([]);
    expect(outcome(after)).toBe('CONTINUE');
  });

  test('a tie with RANDOM draws one of the tied players', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a'], { tieRule: 'RANDOM' });
    const pairs = { a: 'b', b: 'a', c: 'a', d: 'b' };

    const drawnFirst = vote(state, facts, pairs, first);
    const drawnLast = vote(state, facts, pairs, last);

    expect(drawnFirst.lastResult).toMatchObject({ tie: true });
    expect(drawnFirst.eliminated[0]?.reason).toBe('TIE_RANDOM');
    expect(
      [drawnFirst.lastResult?.eliminatedId, drawnLast.lastResult?.eliminatedId].toSorted(),
    ).toEqual(['a', 'b']);
  });

  test('zero votes eliminate nobody', () => {
    const { state, facts } = match(['a', 'b', 'c'], ['a']);
    const after = vote(state, facts, {});
    expect(after.lastResult).toMatchObject({ tie: false, eliminatedId: null });
    expect(after.eliminated).toEqual([]);
  });

  test('ballots of or for players not alive are not counted', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a']);
    const after = vote(state, facts, { a: 'b', z: 'c', c: 'z', d: 'd' });
    expect(after.votedPlayerIds).toEqual(['a']);
    expect(after.lastResult?.eliminatedId).toBe('b');
  });
});

describe('end of the match', () => {
  test('civilians win when the only impostor is voted out without last guess', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a'], { impostorLastGuess: false });
    const after = vote(state, facts, { b: 'a', c: 'a', d: 'a' });

    expect(after.eliminated[0]).toMatchObject({ playerId: 'a', wasImpostor: true });
    expect(outcome(after)).toBe('CIVILIANS');
    expect(after.phase).toBe('REVEAL');

    const finished = nextRound(after, facts);
    expect(finished).toMatchObject({
      status: 'FINISHED',
      phase: 'FINISHED',
      winner: 'CIVILIANS',
      reveal: { word: 'Perro', category: 'Animales', impostorIds: ['a'] },
    });
    expect(matchScores(finished, facts.impostorIds)).toEqual({ b: 1, c: 1, d: 1 });
  });

  test('impostors win by parity', () => {
    const { state, facts } = match(['a', 'b', 'c'], ['a']);
    const after = vote(state, facts, { a: 'b', b: 'c', c: 'b' });

    expect(outcome(after)).toBe('IMPOSTORS');
    const finished = nextRound(after, facts);
    expect(finished.winner).toBe('IMPOSTORS');
    expect(matchScores(finished, facts.impostorIds)).toEqual({ a: 2 });
  });

  test('a right last guess steals the win', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a']);
    const caught = vote(state, facts, { b: 'a', c: 'a', d: 'a' });
    expect(outcome(caught)).toBe('GUESS');

    const guessing = nextRound(caught, facts);
    expect(guessing.phase).toBe('IMPOSTOR_GUESS');
    expect(guessing.guess).toEqual({
      guesserId: 'a',
      options: facts.options,
      chosen: null,
      correct: null,
    });
    expect(guessing.reveal).toBeNull();

    const finished = submitGuess(guessing, 'Perro', facts);
    expect(finished).toMatchObject({
      winner: 'IMPOSTORS',
      guess: { chosen: 'Perro', correct: true },
    });
    expect(matchScores(finished, facts.impostorIds)).toEqual({ a: 2 });
  });

  test('a wrong last guess or a skipped one gives the win to civilians', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a']);
    const guessing = nextRound(vote(state, facts, { b: 'a', c: 'a', d: 'a' }), facts);

    expect(submitGuess(guessing, 'Gato', facts)).toMatchObject({
      winner: 'CIVILIANS',
      guess: { chosen: 'Gato', correct: false },
    });
    expect(skipGuess(guessing, facts)).toMatchObject({
      winner: 'CIVILIANS',
      guess: { chosen: null, correct: null },
    });
  });

  test('several impostors caught in different rounds, the last one gets the guess', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f'];
    const { state, facts } = match(players, ['a', 'b']);

    const round1 = vote(state, facts, { c: 'a', d: 'a', e: 'a', f: 'c' });
    expect(round1.eliminated[0]).toMatchObject({ playerId: 'a', round: 1, wasImpostor: true });
    expect(outcome(round1)).toBe('CONTINUE');

    const voting2 = nextRound(round1, facts);
    expect(voting2).toMatchObject({ phase: 'VOTING', round: 2, votedPlayerIds: [] });
    expect(voting2.lastResult).toBeNull();
    expect(voting2.order).toEqual(['b', 'c', 'd', 'e', 'f']);

    const round2 = vote(voting2, facts, { c: 'd', d: 'c', e: 'd', f: 'd', b: 'd' });
    expect(round2.eliminated[1]).toMatchObject({ playerId: 'd', round: 2, wasImpostor: false });
    expect(outcome(round2)).toBe('CONTINUE');

    const round3 = vote(nextRound(round2, facts), facts, { c: 'b', e: 'b', f: 'b' });
    expect(round3.eliminated[2]).toMatchObject({ playerId: 'b', round: 3, wasImpostor: true });
    expect(outcome(round3)).toBe('GUESS');
    expect(nextRound(round3, facts).guess?.guesserId).toBe('b');

    const civiliansWin = skipGuess(nextRound(round3, facts), facts);
    expect(matchScores(civiliansWin, facts.impostorIds)).toEqual({ c: 1, d: 1, e: 1, f: 1 });
  });
});

describe('a living player leaves or is kicked', () => {
  test('a living last impostor who leaves gives civilians the win with no guess', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a']);
    const { state: after } = removePlayer({
      state,
      playerId: 'a',
      reason: 'LEFT',
      facts,
      ballots: [],
      randomInt: first,
    });
    expect(after.eliminated).toEqual([
      { playerId: 'a', round: 1, wasImpostor: true, reason: 'LEFT' },
    ]);
    expect(after).toMatchObject({ phase: 'FINISHED', winner: 'CIVILIANS', guess: null });
  });

  test('a civilian kicked to parity gives impostors the win', () => {
    const { state, facts } = match(['a', 'b', 'c'], ['a']);
    const { state: after } = removePlayer({
      state,
      playerId: 'b',
      reason: 'KICKED',
      facts,
      ballots: [],
      randomInt: first,
    });
    expect(after.eliminated[0]).toMatchObject({ playerId: 'b', reason: 'KICKED' });
    expect(after.winner).toBe('IMPOSTORS');
  });

  test('in voting their ballot and the ballots for them are dropped, then the round may close', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd', 'e'], ['a']);
    const ballots = votes({ a: 'e', b: 'e', c: 'e', e: 'a', d: 'c' });
    const voted = recordBallots(state, votes({ a: 'e', b: 'e', c: 'e', e: 'a' }));

    const { state: after, dropped } = removePlayer({
      state: voted,
      playerId: 'e',
      reason: 'LEFT',
      facts,
      ballots: ballots.filter((ballot) => ballot.voterId !== 'd'),
      randomInt: first,
    });
    expect(dropped.map((ballot) => ballot.voterId).toSorted()).toEqual(['a', 'b', 'c', 'e']);
    expect(after).toMatchObject({ phase: 'VOTING', votedPlayerIds: [] });

    const { state: closed } = removePlayer({
      state: recordBallots(state, ballots),
      playerId: 'b',
      reason: 'LEFT',
      facts,
      ballots,
      randomInt: first,
    });
    expect(closed.phase).toBe('REVEAL');
    expect(closed.lastResult?.eliminatedId).toBe('e');
  });

  test('the caught impostor leaving before or during the guess gives civilians the win', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a']);
    const caught = vote(state, facts, { b: 'a', c: 'a', d: 'a' });
    const leave = (from: ImpostorPublic) =>
      removePlayer({
        state: from,
        playerId: 'a',
        reason: 'LEFT',
        facts,
        ballots: [],
        randomInt: first,
      }).state;

    expect(leave(caught)).toMatchObject({ phase: 'FINISHED', winner: 'CIVILIANS' });
    expect(leave(nextRound(caught, facts))).toMatchObject({
      phase: 'FINISHED',
      winner: 'CIVILIANS',
    });
  });

  test('a spectator, an eliminated player or anyone after the end changes nothing', () => {
    const { state, facts } = match(['a', 'b', 'c', 'd'], ['a'], { impostorLastGuess: false });
    const leave = (from: ImpostorPublic, playerId: string) =>
      removePlayer({ state: from, playerId, reason: 'LEFT', facts, ballots: [], randomInt: first })
        .state;

    expect(leave(state, 'z')).toBe(state);
    const revealed = vote(state, facts, { a: 'b', c: 'b', d: 'b' });
    expect(leave(revealed, 'b')).toBe(revealed);
    const finished = nextRound(vote(state, facts, { b: 'a', c: 'a', d: 'a' }), facts);
    expect(leave(finished, 'c')).toBe(finished);
  });
});
