import { describe, expect, test } from 'vitest';
import type { Spectrum, WavelengthPublic } from '../domain.ts';
import type { RandomInt } from '../random.ts';
import { wavelengthConfigSchema } from '../schemas.ts';
import {
  allCommitted,
  clueProblem,
  dialGuessProblem,
  dialPoints,
  drawTarget,
  dropWavelengthPlayer,
  giveClue,
  guessersOf,
  nextTurn,
  openRound,
  pickSpectrum,
  psychicPoints,
  recordCommits,
  revealRound,
  startWavelength,
  wavelengthScores,
  wavelengthStartProblem,
} from './rules.ts';

const first: RandomInt = () => 0;
const last: RandomInt = (max) => max - 1;
const spectrum: Spectrum = { id: 'frio-caliente', left: 'Frío', right: 'Caliente' };
const other: Spectrum = { id: 'barato-caro', left: 'Barato', right: 'Caro' };

function match(players: string[], cycles = 1): WavelengthPublic {
  return startWavelength({
    matchId: 'M1',
    config: { cycles },
    participants: players,
    spectrum,
    randomInt: first,
  });
}

function guessing(state: WavelengthPublic): WavelengthPublic {
  return giveClue(state, 'Sopa');
}

function playRound(state: WavelengthPublic, target = 50): WavelengthPublic {
  const revealed = revealRound(guessing(state), target, []);
  const turn = nextTurn(revealed);
  return turn === null ? revealed : openRound(revealed, turn, other);
}

describe('scoring', () => {
  test.each([
    [50, 50, 4],
    [48, 50, 4],
    [52, 50, 4],
    [47, 50, 3],
    [57, 50, 3],
    [58, 50, 2],
    [38, 50, 2],
    [37, 50, 0],
    [63, 50, 0],
    [0, 2, 4],
    [100, 93, 3],
    [0, 100, 0],
  ])('a guess of %i on target %i scores %i, bands inclusive', (value, target, points) => {
    expect(dialPoints(value, target)).toBe(points);
  });

  test.each([
    [[], 0],
    [[4], 4],
    [[3, 2], 3],
    [[2, 1], 2],
    [[1, 0, 0], 0],
    [[2, 1, 1], 1],
    [[4, 4, 0, 1], 2],
  ])('the psychic gets the average of %j rounded half up: %i', (points, expected) => {
    expect(psychicPoints(points)).toBe(expected);
  });

  test('the reveal scores each committed guess, 0 for the rest, and the psychic average', () => {
    const state = guessing(match(['a', 'b', 'c', 'd']));
    expect(state.psychicId).toBe('b');

    const revealed = revealRound(state, 40, [
      { playerId: 'a', value: 43 },
      { playerId: 'c', value: 52 },
    ]);

    expect(revealed.phase).toBe('REVEAL');
    expect(revealed.lastResult).toEqual({
      round: 1,
      psychicId: 'b',
      target: 40,
      guesses: [
        { playerId: 'a', value: 43, points: 3 },
        { playerId: 'c', value: 52, points: 2 },
        { playerId: 'd', value: null, points: 0 },
      ],
      psychicPoints: 3,
    });
    expect(revealed.totals).toEqual({ a: 3, b: 3, c: 2, d: 0 });
    expect(revealed.committedPlayerIds).toEqual(['a', 'c']);
  });

  test('a guess by the psychic or an outsider is never counted', () => {
    const revealed = revealRound(guessing(match(['a', 'b', 'c'])), 50, [
      { playerId: 'b', value: 50 },
      { playerId: 'x', value: 50 },
    ]);
    expect(revealed.lastResult?.psychicPoints).toBe(0);
    expect(revealed.totals).toEqual({ a: 0, b: 0, c: 0 });
  });

  test('totals accumulate across rounds and only players still in score at the end', () => {
    let state = guessing(match(['a', 'b', 'c']));
    state = revealRound(state, 50, [
      { playerId: 'a', value: 50 },
      { playerId: 'c', value: 70 },
    ]);
    const turn = nextTurn(state);
    if (turn === null) throw new Error('expected another turn');
    state = guessing(openRound(state, turn, other));
    state = revealRound(state, 10, [{ playerId: 'b', value: 12 }]);

    expect(state.totals).toEqual({ a: 4, b: 6, c: 4 });
    const { state: afterLeave } = dropWavelengthPlayer(state, 'c');
    expect(wavelengthScores(afterLeave)).toEqual({ a: 4, b: 6 });
  });
});

describe('the psychic rotation', () => {
  test('the order is drawn once and every participant is psychic once per cycle', () => {
    let state = match(['a', 'b', 'c'], 2);
    expect(state.order.toSorted()).toEqual(['a', 'b', 'c']);
    const psychics = [state.psychicId];
    for (;;) {
      const next = playRound(state);
      if (next.phase === 'REVEAL') break;
      psychics.push(next.psychicId);
      state = next;
    }
    expect(psychics).toEqual([...state.order, ...state.order]);
    expect(state.round).toBe(6);
  });

  test('the last turn has no next one and an order shuffle uses the random source', () => {
    const state = match(['a', 'b', 'c']);
    expect(match(['a', 'b', 'c']).order).toEqual(state.order);
    expect(
      startWavelength({
        matchId: 'M1',
        config: { cycles: 1 },
        participants: ['a', 'b', 'c'],
        spectrum,
        randomInt: last,
      }).order,
    ).not.toEqual(state.order);
    expect(nextTurn({ ...state, turn: 2 })).toBeNull();
  });

  test('departed players lose their later turns', () => {
    const state = match(['a', 'b', 'c', 'd'], 2);
    const { state: dropped } = dropWavelengthPlayer(state, state.order[1] ?? '');
    expect(nextTurn(dropped)).toBe(2);
    expect(nextTurn({ ...dropped, turn: 4 })).toBe(6);
  });
});

describe('a round', () => {
  test('only the psychic gives the clue, once, and only guessers commit', () => {
    const state = match(['a', 'b', 'c']);
    expect(clueProblem(state, 'a', 1)).toBe('NOT_PSYCHIC');
    expect(clueProblem(state, 'b', 2)).toBe('STALE_ROUND');
    expect(clueProblem(state, 'b', 1)).toBeNull();
    expect(dialGuessProblem(state, 'a', 1)).toBe('STALE_ROUND');

    const open = guessing(state);
    expect(open).toMatchObject({ phase: 'GUESS', clue: 'Sopa' });
    expect(clueProblem(open, 'b', 1)).toBe('STALE_ROUND');
    expect(dialGuessProblem(open, 'a', 1)).toBeNull();
    expect(dialGuessProblem(open, 'b', 1)).toBe('INVALID_GUESS');
    expect(dialGuessProblem(open, 'x', 1)).toBe('INVALID_GUESS');
    expect(dialGuessProblem(open, 'a', 2)).toBe('STALE_ROUND');
  });

  test('the round completes when every guesser committed', () => {
    const state = guessing(match(['a', 'b', 'c', 'd']));
    const partial = recordCommits(state, [{ playerId: 'a', value: 10 }]);
    expect(partial.committedPlayerIds).toEqual(['a']);
    expect(allCommitted(partial)).toBe(false);

    const full = recordCommits(state, [
      { playerId: 'd', value: 1 },
      { playerId: 'c', value: 2 },
      { playerId: 'a', value: 3 },
    ]);
    expect(full.committedPlayerIds).toEqual(['a', 'c', 'd']);
    expect(allCommitted(full)).toBe(true);
  });

  test('a new round clears the clue, the commits and the result, and records a skip', () => {
    const revealed = revealRound(guessing(match(['a', 'b', 'c'])), 50, []);
    const next = openRound(revealed, 1, other, { round: 1, psychicId: 'b', reason: 'SKIPPED' });
    expect(next).toMatchObject({
      phase: 'CLUE',
      round: 2,
      turn: 1,
      psychicId: revealed.order[1],
      spectrum: other,
      clue: null,
      committedPlayerIds: [],
      lastResult: null,
      skipped: { round: 1, psychicId: 'b', reason: 'SKIPPED' },
    });
    expect(guessing(next).skipped).toBeNull();
  });
});

describe('a player leaves', () => {
  test('a guesser is dropped from the round and their commit is discarded', () => {
    const state = recordCommits(guessing(match(['a', 'b', 'c', 'd'])), [
      { playerId: 'c', value: 30 },
    ]);
    const { state: dropped, cancelsRound } = dropWavelengthPlayer(state, 'c');
    expect(cancelsRound).toBe(false);
    expect(dropped.committedPlayerIds).toEqual([]);
    expect(guessersOf(dropped)).toEqual(['a', 'd']);
    expect(allCommitted(recordCommits(dropped, [{ playerId: 'a', value: 1 }]))).toBe(false);
    expect(
      allCommitted(
        recordCommits(dropped, [
          { playerId: 'a', value: 1 },
          { playerId: 'd', value: 1 },
        ]),
      ),
    ).toBe(true);
  });

  test('the psychic leaving in CLUE or GUESS cancels the round, in REVEAL it does not', () => {
    const state = match(['a', 'b', 'c', 'd']);
    expect(dropWavelengthPlayer(state, 'b').cancelsRound).toBe(true);
    expect(dropWavelengthPlayer(guessing(state), 'b').cancelsRound).toBe(true);
    const revealed = revealRound(guessing(state), 50, []);
    expect(dropWavelengthPlayer(revealed, 'b').cancelsRound).toBe(false);
  });

  test('under 2 players left the match finishes with the points so far', () => {
    const revealed = revealRound(guessing(match(['a', 'b', 'c'])), 50, [
      { playerId: 'a', value: 50 },
    ]);
    const { state: two } = dropWavelengthPlayer(revealed, 'c');
    expect(two.status).toBe('PLAYING');
    const { state: one } = dropWavelengthPlayer(two, 'b');
    expect(one).toMatchObject({ status: 'FINISHED', phase: 'FINISHED' });
    expect(wavelengthScores(one)).toEqual({ a: 4 });
  });

  test('someone outside the match or a finished match changes nothing', () => {
    const state = match(['a', 'b', 'c']);
    expect(dropWavelengthPlayer(state, 'x').state).toBe(state);
    const { state: once } = dropWavelengthPlayer(state, 'a');
    expect(dropWavelengthPlayer(once, 'a').state).toBe(once);
    const finished = { ...state, status: 'FINISHED' as const };
    expect(dropWavelengthPlayer(finished, 'a').state).toBe(finished);
  });
});

describe('setup', () => {
  test('three players are needed and cycles go from 1 to 3', () => {
    expect(wavelengthStartProblem(2)).toBe('NOT_ENOUGH_PLAYERS');
    expect(wavelengthStartProblem(3)).toBeNull();
    expect(wavelengthConfigSchema.safeParse({ cycles: 1 }).success).toBe(true);
    expect(wavelengthConfigSchema.safeParse({ cycles: 3 }).success).toBe(true);
    expect(wavelengthConfigSchema.safeParse({ cycles: 0 }).success).toBe(false);
    expect(wavelengthConfigSchema.safeParse({ cycles: 4 }).success).toBe(false);
    expect(wavelengthConfigSchema.safeParse({ cycles: 1.5 }).success).toBe(false);
    expect(wavelengthConfigSchema.safeParse({ cycles: 1, extra: true }).success).toBe(false);
  });

  test('the target is an integer from 0 to 100', () => {
    expect(drawTarget(first)).toBe(0);
    expect(drawTarget(last)).toBe(100);
  });

  test('a spectrum is never repeated until the bank is exhausted, then it starts over', () => {
    const bank = [spectrum, other, { id: 'feo-bonito', left: 'Feo', right: 'Bonito' }];
    const firstPick = pickSpectrum(bank, ['frio-caliente'], first);
    expect(firstPick).toEqual({
      spectrum: other,
      usedSpectrumIds: ['frio-caliente', 'barato-caro'],
    });
    const lastPick = pickSpectrum(bank, firstPick.usedSpectrumIds, first);
    expect(lastPick.spectrum.id).toBe('feo-bonito');

    const reset = pickSpectrum(bank, lastPick.usedSpectrumIds, last);
    expect(reset).toEqual({ spectrum: bank[2], usedSpectrumIds: ['feo-bonito'] });
  });
});
