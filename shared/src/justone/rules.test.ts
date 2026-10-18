import { describe, expect, test } from 'vitest';
import type { JustOneClue, JustOnePublic } from '../domain.ts';
import type { RandomInt } from '../random.ts';
import { justOneConfigSchema } from '../schemas.ts';
import {
  acceptGuess,
  acceptGuessProblem,
  allCluesIn,
  autoCancelled,
  cancelClueProblem,
  clueGiversOf,
  dropJustOnePlayer,
  justOneClueProblem,
  justOneGuessProblem,
  justOneScores,
  justOneStartProblem,
  nextJustOneTurn,
  normalizeWord,
  openJustOneRound,
  openReview,
  pickJustOneWord,
  recordClues,
  revealJustOne,
  sameWord,
  scoreAfter,
  setClueCancelled,
  showClues,
  showCluesProblem,
  startJustOne,
} from './rules.ts';

const first: RandomInt = () => 0;
const last: RandomInt = (max) => max - 1;

function match(players: string[], cycles = 1): JustOnePublic {
  return startJustOne({
    matchId: 'M1',
    config: { cycles },
    participants: players,
    randomInt: last,
  });
}

function cluesFor(state: JustOnePublic, texts: string[]): JustOneClue[] {
  return clueGiversOf(state).flatMap((authorId, index) => {
    const clue = texts[index];
    return clue === undefined ? [] : [{ authorId, clue }];
  });
}

function guessing(state: JustOnePublic, texts: string[], word = 'Perro'): JustOnePublic {
  const clues = cluesFor(state, texts);
  return showClues(openReview(state, clues, word), clues);
}

function playRound(state: JustOnePublic, guess: string | null, word = 'Perro'): JustOnePublic {
  const clues = cluesFor(state, ['Ladra', 'Hueso']);
  const revealed = revealJustOne(guessing(state, ['Ladra', 'Hueso'], word), { word, guess, clues });
  const turn = nextJustOneTurn(revealed);
  return turn === null ? revealed : openJustOneRound(revealed, turn);
}

describe('normalization', () => {
  test.each([
    ['Árbol', 'arbol'],
    ['  CAMIÓN ', 'camion'],
    ['Pingüino', 'pinguino'],
    ['Niño', 'niño'],
    ['NIÑO', 'niño'],
    ['¡Sol!', 'sol'],
    ['hot-dog', 'hotdog'],
  ])('%s normalizes to %s', (text, normalized) => {
    expect(normalizeWord(text)).toBe(normalized);
  });

  test.each([
    ['perro', 'Perros'],
    ['árbol', 'ARBOLES'],
    ['luz', 'luces'],
    ['Lápiz', 'lápices'],
    ['mes', 'meses'],
    ['café', 'cafés'],
    ['flor', 'flores'],
    ['canción', 'canciones'],
  ])('%s and %s are the same word', (a, b) => {
    expect(sameWord(a, b)).toBe(true);
    expect(sameWord(b, a)).toBe(true);
  });

  test.each([
    ['año', 'ano'],
    ['casa', 'cosa'],
    ['perro', 'perrito'],
    ['mar', 'marea'],
    ['', ''],
    ['!!', '??'],
  ])('%s and %s are different words', (a, b) => {
    expect(sameWord(a, b)).toBe(false);
  });
});

describe('automatic cancellation', () => {
  test('every clue that repeats another after normalization is cancelled, all copies', () => {
    const clues = [
      { authorId: 'a', clue: 'Ladrido' },
      { authorId: 'b', clue: 'Hueso' },
      { authorId: 'c', clue: 'ladridos' },
      { authorId: 'd', clue: 'HUESO' },
      { authorId: 'e', clue: 'Correa' },
    ];
    expect(autoCancelled(clues, 'Perro')).toEqual(['a', 'b', 'c', 'd']);
  });

  test('a clue equal to the word is cancelled even when it is unique', () => {
    const clues = [
      { authorId: 'a', clue: 'perros' },
      { authorId: 'b', clue: 'Mascota' },
    ];
    expect(autoCancelled(clues, 'Perro')).toEqual(['a']);
  });

  test('a clue that only contains the word is left to the manual review', () => {
    expect(autoCancelled([{ authorId: 'a', clue: 'Perrera' }], 'Perro')).toEqual([]);
  });
});

describe('the word bank', () => {
  const bank = [{ id: 'perro' }, { id: 'gato' }, { id: 'sol' }];

  test('picks only words not used that night and records the pick', () => {
    expect(pickJustOneWord(bank, ['perro'], first)).toEqual({
      word: { id: 'gato' },
      usedJustOneWordIds: ['perro', 'gato'],
    });
    expect(pickJustOneWord(bank, ['perro'], last).word).toEqual({ id: 'sol' });
  });

  test('restarts from the whole bank when every word was used', () => {
    expect(pickJustOneWord(bank, ['perro', 'gato', 'sol'], last)).toEqual({
      word: { id: 'sol' },
      usedJustOneWordIds: ['sol'],
    });
  });
});

describe('starting', () => {
  test('needs at least 3 players and a cycle count from 1 to 3', () => {
    expect(justOneStartProblem(2)).toBe('NOT_ENOUGH_PLAYERS');
    expect(justOneStartProblem(3)).toBeNull();
    expect(justOneConfigSchema.safeParse({ cycles: 0 }).success).toBe(false);
    expect(justOneConfigSchema.safeParse({ cycles: 4 }).success).toBe(false);
    expect(justOneConfigSchema.safeParse({ cycles: 1, extra: true }).success).toBe(false);
    expect(justOneConfigSchema.parse({ cycles: 3 })).toEqual({ cycles: 3 });
  });

  test('the first player of the drawn order guesses and the rest give clues', () => {
    const state = startJustOne({
      matchId: 'M1',
      config: { cycles: 1 },
      participants: ['a', 'b', 'c'],
      randomInt: first,
    });
    expect(state.order).toEqual(['b', 'c', 'a']);
    expect(state).toMatchObject({ phase: 'CLUE', round: 1, turn: 0, score: 0, clues: null });
    expect(state.guesserId).toBe(state.order[0]);
    expect(clueGiversOf(state)).toEqual(state.participants.filter((id) => id !== state.guesserId));
  });
});

describe('clues', () => {
  test('only clue-givers of the open round may commit', () => {
    const state = match(['a', 'b', 'c']);
    expect(justOneClueProblem(state, 'b', 1)).toBeNull();
    expect(justOneClueProblem(state, state.guesserId, 1)).toBe('NOT_CLUE_GIVER');
    expect(justOneClueProblem(state, 'spectator', 1)).toBe('NOT_CLUE_GIVER');
    expect(justOneClueProblem(state, 'b', 2)).toBe('STALE_ROUND');
  });

  test('the phase is complete only when every clue-giver committed', () => {
    const state = match(['a', 'b', 'c']);
    const one = recordClues(state, ['b', 'a', 'stranger']);
    expect(one.committedPlayerIds).toEqual(['b']);
    expect(allCluesIn(one)).toBe(false);
    expect(allCluesIn(recordClues(state, ['b', 'c']))).toBe(true);
  });

  test('review lists the committed clue-givers with the automatic cancellations', () => {
    const state = match(['a', 'b', 'c', 'd']);
    const review = openReview(state, cluesFor(state, ['Hueso', 'huesos']), 'Perro');
    expect(review).toMatchObject({
      phase: 'REVIEW',
      committedPlayerIds: ['b', 'c'],
      cancelledAuthorIds: ['b', 'c'],
    });
  });
});

describe('review', () => {
  const state = match(['a', 'b', 'c', 'd']);
  const review = openReview(state, cluesFor(state, ['Ladra', 'Hueso', 'Correa']), 'Perro');

  test('any clue-giver cancels or restores a committed clue, idempotently', () => {
    expect(cancelClueProblem(review, 'b', 1, 'd')).toBeNull();
    expect(cancelClueProblem(review, 'a', 1, 'd')).toBe('NOT_CLUE_GIVER');
    expect(cancelClueProblem(review, 'b', 1, 'stranger')).toBe('TARGET_NOT_MEMBER');
    expect(cancelClueProblem(review, 'b', 2, 'd')).toBe('STALE_ROUND');

    const cancelled = setClueCancelled(review, 'd', true);
    expect(cancelled.cancelledAuthorIds).toEqual(['d']);
    expect(setClueCancelled(cancelled, 'd', true)).toEqual(cancelled);
    expect(setClueCancelled(setClueCancelled(cancelled, 'b', true), 'd', false)).toMatchObject({
      cancelledAuthorIds: ['b'],
    });
  });

  test('clue-givers and the host show the clues, the guesser alone cannot', () => {
    expect(showCluesProblem(review, 'b', 'a', 1)).toBeNull();
    expect(showCluesProblem(review, 'a', 'a', 1)).toBeNull();
    expect(showCluesProblem(review, 'a', 'b', 1)).toBe('NOT_CLUE_GIVER');
    expect(showCluesProblem(review, 'b', 'a', 2)).toBe('STALE_ROUND');
  });

  test('only the surviving clues go public', () => {
    const clues = cluesFor(state, ['Ladra', 'Hueso', 'Correa']);
    const shown = showClues(setClueCancelled(review, 'c', true), clues);
    expect(shown.phase).toBe('GUESS');
    expect(shown.clues).toEqual([
      { authorId: 'b', clue: 'Ladra' },
      { authorId: 'd', clue: 'Correa' },
    ]);
  });
});

describe('guess and score', () => {
  test('only the guesser of the open round guesses', () => {
    const state = guessing(match(['a', 'b', 'c']), ['Ladra', 'Hueso']);
    expect(justOneGuessProblem(state, 'a', 1)).toBeNull();
    expect(justOneGuessProblem(state, 'b', 1)).toBe('INVALID_GUESS');
    expect(justOneGuessProblem(state, 'a', 2)).toBe('STALE_ROUND');
  });

  test.each([
    [0, 'CORRECT', 1],
    [2, 'CORRECT', 3],
    [2, 'PASS', 2],
    [2, 'WRONG', 1],
    [0, 'WRONG', 0],
  ] as const)('from %i a %s round leaves %i', (before, outcome, after) => {
    expect(scoreAfter(before, outcome)).toBe(after);
  });

  test('the reveal checks the guess by normalization and lists every clue', () => {
    const state = match(['a', 'b', 'c']);
    const clues = cluesFor(state, ['Hueso', 'huesos']);
    const revealed = revealJustOne(guessing(state, ['Hueso', 'huesos']), {
      word: 'Perro',
      guess: ' PERROS ',
      clues,
    });
    expect(revealed).toMatchObject({ phase: 'REVEAL', score: 1, roundsWon: 1 });
    expect(revealed.lastResult).toEqual({
      round: 1,
      guesserId: 'a',
      word: 'Perro',
      guess: ' PERROS ',
      outcome: 'CORRECT',
      accepted: false,
      clues: [
        { authorId: 'b', clue: 'Hueso', cancelled: true },
        { authorId: 'c', clue: 'huesos', cancelled: true },
      ],
      scoreBefore: 0,
      score: 1,
    });
  });

  test('a pass scores 0 and a wrong guess never takes the score below 0', () => {
    const state = match(['a', 'b', 'c'], 2);
    const afterPass = playRound(state, null);
    expect(afterPass).toMatchObject({ score: 0, roundsWon: 0 });
    const afterWrong = playRound(afterPass, 'Gato');
    expect(afterWrong.score).toBe(0);
    const won = playRound(playRound(afterWrong, 'perro'), 'Perro');
    expect(won).toMatchObject({ score: 2, roundsWon: 2 });
    const revealedWrong = revealJustOne(guessing(won, ['Ladra', 'Hueso']), {
      word: 'Perro',
      guess: 'Lobo',
      clues: [],
    });
    expect(revealedWrong.score).toBe(1);
  });

  test('the host counts a wrong guess as correct once, from the score before it', () => {
    const state = match(['a', 'b', 'c'], 2);
    const atTwo = { ...guessing(state, ['Ladra', 'Hueso']), score: 2 };
    const wrong = revealJustOne(atTwo, { word: 'Perro', guess: 'Perrro', clues: [] });
    expect(wrong.score).toBe(1);
    expect(acceptGuessProblem(wrong, 1)).toBeNull();
    expect(acceptGuessProblem(wrong, 2)).toBe('STALE_ROUND');

    const accepted = acceptGuess(wrong);
    expect(accepted).toMatchObject({ score: 3, roundsWon: 1 });
    expect(accepted.lastResult).toMatchObject({ outcome: 'CORRECT', accepted: true, score: 3 });
    expect(acceptGuessProblem(accepted, 1)).toBe('STALE_ROUND');

    const floored = revealJustOne(
      { ...guessing(state, ['Ladra', 'Hueso']), score: 0 },
      { word: 'Perro', guess: 'Gato', clues: [] },
    );
    expect(acceptGuess(floored).score).toBe(1);
    const passed = revealJustOne(guessing(state, ['Ladra', 'Hueso']), {
      word: 'Perro',
      guess: null,
      clues: [],
    });
    expect(acceptGuessProblem(passed, 1)).toBe('STALE_ROUND');
  });
});

describe('rotation', () => {
  test('every participant guesses once per cycle in the drawn order, then it ends', () => {
    let state = match(['a', 'b', 'c'], 2);
    const guessers: string[] = [];
    while (state.phase === 'CLUE') {
      guessers.push(state.guesserId);
      state = playRound(state, 'Perro');
    }
    expect(guessers).toEqual([...state.order, ...state.order]);
    expect(state.round).toBe(6);
    expect(nextJustOneTurn(state)).toBeNull();
  });

  test('a turn of a player who left is skipped', () => {
    const state = match(['a', 'b', 'c', 'd']);
    const { state: dropped } = dropJustOnePlayer(state, 'b');
    expect(nextJustOneTurn(dropped)).toBe(2);
  });
});

describe('departures', () => {
  test('a guesser who leaves before the reveal cancels the round', () => {
    const state = match(['a', 'b', 'c', 'd']);
    for (const phase of [state, openReview(state, [], 'Perro'), guessing(state, [])]) {
      const { state: dropped, cancelsRound } = dropJustOnePlayer(phase, 'a');
      expect(cancelsRound).toBe(true);
      expect(dropped.departedIds).toEqual(['a']);
    }
    const revealed = revealJustOne(guessing(state, []), { word: 'Perro', guess: null, clues: [] });
    const inReveal = dropJustOnePlayer(revealed, 'a');
    expect(inReveal.cancelsRound).toBe(false);
    expect(inReveal.state.phase).toBe('REVEAL');
  });

  test('a clue-giver who leaves in clue or review takes only their own clue out', () => {
    const state = match(['a', 'b', 'c', 'd']);
    const clues = cluesFor(state, ['Hueso', 'Hueso', 'Correa']);
    const committed = recordClues(state, ['b', 'd']);
    const inClue = dropJustOnePlayer(committed, 'b');
    expect(inClue).toMatchObject({ cancelsRound: false, state: { committedPlayerIds: ['d'] } });
    expect(allCluesIn(inClue.state)).toBe(false);
    expect(allCluesIn(dropJustOnePlayer(inClue.state, 'c').state)).toBe(true);

    const review = openReview(state, clues, 'Perro');
    const inReview = dropJustOnePlayer(review, 'b').state;
    expect(inReview).toMatchObject({ committedPlayerIds: ['c', 'd'], cancelledAuthorIds: ['c'] });
    expect(showClues(inReview, clues).clues).toEqual([{ authorId: 'd', clue: 'Correa' }]);
  });

  test('a clue-giver who leaves in guess keeps their clue on the table and in the reveal', () => {
    const state = match(['a', 'b', 'c', 'd']);
    const clues = cluesFor(state, ['Ladra', 'Hueso', 'Correa']);
    const shown = guessing(state, ['Ladra', 'Hueso', 'Correa']);
    const { state: dropped } = dropJustOnePlayer(shown, 'b');
    expect(dropped.clues).toEqual(shown.clues);
    const revealed = revealJustOne(dropped, { word: 'Perro', guess: null, clues });
    expect(revealed.lastResult?.clues.map((clue) => clue.authorId)).toEqual(['b', 'c', 'd']);
  });

  test('under 2 players the match finishes with the score so far, for those still in', () => {
    const state = playRound(match(['a', 'b', 'c']), 'Perro');
    const two = dropJustOnePlayer(state, 'a').state;
    expect(two.status).toBe('PLAYING');
    const { state: finished, cancelsRound } = dropJustOnePlayer(two, 'c');
    expect(cancelsRound).toBe(false);
    expect(finished).toMatchObject({ status: 'FINISHED', phase: 'FINISHED', score: 1 });
    expect(justOneScores(finished)).toEqual({ b: 1 });
  });

  test('a player not in the match changes nothing', () => {
    const state = match(['a', 'b', 'c']);
    expect(dropJustOnePlayer(state, 'stranger')).toEqual({ state, cancelsRound: false });
  });

  test('a score of 0 adds nothing to the totals', () => {
    expect(justOneScores(match(['a', 'b', 'c']))).toEqual({});
  });
});
