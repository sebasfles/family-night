import { describe, expect, test } from 'vitest';
import type { ManadaConfig, ManadaPublic } from '../domain.ts';
import type { RandomInt } from '../random.ts';
import { manadaConfigSchema } from '../schemas.ts';
import {
  allAnswersIn,
  dropManadaPlayer,
  finishManada,
  groupAnswers,
  isManadaAnswer,
  manadaAnswerProblem,
  manadaGoalReached,
  manadaNightPoints,
  manadaStartProblem,
  manadaWinners,
  mergeGroups,
  openManadaRound,
  pickManadaQuestion,
  recordAnswers,
  regroupProblem,
  revealManada,
  sameAnswer,
  splitGroup,
  startManada,
} from './rules.ts';

const QUESTION = { id: 'q1', text: 'Una fruta amarilla' };
const players = ['a', 'b', 'c', 'd', 'e'];

function match(
  ids: string[] = players,
  config: ManadaConfig = { goal: 'ROUNDS', rounds: 10 },
): ManadaPublic {
  return startManada({ matchId: 'M1', config, participants: ids, question: QUESTION });
}

function answered(answers: Record<string, string>) {
  return Object.entries(answers).map(([playerId, answer]) => ({ playerId, answer }));
}

function reveal(state: ManadaPublic, answers: Record<string, string>): ManadaPublic {
  return revealManada(recordAnswers(state, Object.keys(answers)), answered(answers));
}

function next(state: ManadaPublic): ManadaPublic {
  return openManadaRound(state, { id: `q${String(state.round + 1)}`, text: 'Otra' });
}

function withTotals(
  state: ManadaPublic,
  totals: Record<string, number>,
  cowHolderId: string | null = null,
): ManadaPublic {
  return { ...state, totals: { ...state.totals, ...totals }, cowHolderId };
}

function groupsOf(state: ManadaPublic): string[][] {
  return state.lastResult?.groups.map((group) => group.playerIds) ?? [];
}

function pointsOf(state: ManadaPublic): Record<string, number> {
  return Object.fromEntries(
    state.lastResult?.groups.flatMap((group) => group.playerIds.map((id) => [id, group.points])) ??
      [],
  );
}

describe('answers', () => {
  test('an answer is 1 to 3 words and up to 30 characters with a letter or digit', () => {
    expect(isManadaAnswer('Plátano')).toBe(true);
    expect(isManadaAnswer('  perro   caliente  ')).toBe(true);
    expect(isManadaAnswer('el sol de lima')).toBe(false);
    expect(isManadaAnswer('a'.repeat(31))).toBe(false);
    expect(isManadaAnswer('   ')).toBe(false);
    expect(isManadaAnswer('¡¿?!')).toBe(false);
  });

  test('answers match ignoring case, accents, plural per word and a leading article', () => {
    expect(sameAnswer('Plátano', 'platano')).toBe(true);
    expect(sameAnswer('perros calientes', 'Perro caliente')).toBe(true);
    expect(sameAnswer('la luz', 'luces')).toBe(true);
    expect(sameAnswer('Unas papas', 'papa')).toBe(true);
    expect(sameAnswer('el sol', 'sol')).toBe(true);
  });

  test('different words, word counts or a bare article do not match', () => {
    expect(sameAnswer('Mango', 'Manzana')).toBe(false);
    expect(sameAnswer('hot dog', 'hotdog')).toBe(false);
    expect(sameAnswer('perro caliente', 'perro')).toBe(false);
    expect(sameAnswer('la', 'sol')).toBe(false);
    expect(sameAnswer('año', 'ano')).toBe(false);
  });
});

describe('grouping', () => {
  test('groups are transitive, largest first, ties by who answered first', () => {
    const groups = groupAnswers(
      answered({ a: 'me', b: 'Mango', c: 'meses', d: 'mes', e: 'mango' }),
      [],
    );
    expect(groups.map((group) => group.playerIds)).toEqual([
      ['a', 'c', 'd'],
      ['b', 'e'],
    ]);
    expect(groups.map((group) => group.id)).toEqual(['a', 'b']);
    expect(groups[0]?.labels).toEqual(['me']);
    expect(groups.every((group) => !group.merged)).toBe(true);
  });

  test('the same answers give the same groups whatever order they are stored in', () => {
    const answers = answered({ a: 'Sol', b: 'Luna', c: 'soles', d: 'luna' });
    expect(groupAnswers(answers.toReversed(), []).map((g) => g.playerIds.toSorted())).toEqual(
      groupAnswers(answers, [])
        .map((g) => g.playerIds.toSorted())
        .toReversed(),
    );
  });
});

describe('majority', () => {
  test('the one largest group scores 1 point per member', () => {
    const state = reveal(match(), { a: 'Mango', b: 'mangos', c: 'Plátano', d: 'Piña', e: 'mango' });
    expect(pointsOf(state)).toEqual({ a: 1, b: 1, e: 1, c: 0, d: 0 });
    expect(state.totals).toEqual({ a: 1, b: 1, c: 0, d: 0, e: 1 });
  });

  test('a tie for the largest group scores nobody', () => {
    const state = reveal(match(), { a: 'Mango', b: 'mango', c: 'Piña', d: 'piña', e: 'Plátano' });
    expect(Object.values(state.totals)).toEqual([0, 0, 0, 0, 0]);
  });

  test('when everyone is alone nobody scores', () => {
    const state = reveal(match(), { a: 'Mango', b: 'Piña', c: 'Plátano', d: 'Limón', e: 'Kiwi' });
    expect(Object.values(state.totals)).toEqual([0, 0, 0, 0, 0]);
  });

  test('a player with no answer is in no group and scores nothing', () => {
    const state = reveal(match(), { a: 'Mango', b: 'mango', c: 'Piña' });
    expect(groupsOf(state)).toEqual([['a', 'b'], ['c']]);
    expect(state.totals).toEqual({ a: 1, b: 1, c: 0, d: 0, e: 0 });
  });

  test('totals add to what each player had before the round', () => {
    const second = reveal(next(reveal(match(), { a: 'Sol', b: 'sol', c: 'Luna' })), {
      a: 'Mar',
      c: 'mar',
      d: 'Río',
    });
    expect(second.totals).toEqual({ a: 2, b: 1, c: 1, d: 0, e: 0 });
  });
});

describe('the pink cow', () => {
  test('goes to the only player alone when a group of 2 or more exists', () => {
    const state = reveal(match(), { a: 'Mango', b: 'mango', c: 'mangos', d: 'Piña' });
    expect(state.cowHolderId).toBe('d');
  });

  test('does not move with two or more players alone', () => {
    const before = { ...match(), cowHolderId: 'a' };
    const state = reveal(before, { a: 'Mango', b: 'mango', c: 'Piña', d: 'Kiwi' });
    expect(state.cowHolderId).toBe('a');
  });

  test('does not move when everyone is alone', () => {
    const before = { ...match(), cowHolderId: 'e' };
    const state = reveal(before, { a: 'Mango', b: 'Piña', c: 'Plátano', d: 'Limón' });
    expect(state.cowHolderId).toBe('e');
  });

  test('moves even when the largest groups tie', () => {
    const state = reveal(match(), { a: 'Mango', b: 'mango', c: 'Piña', d: 'piña', e: 'Kiwi' });
    expect(state.cowHolderId).toBe('e');
  });

  test('a player without an answer is never the one alone', () => {
    const state = reveal({ ...match(), cowHolderId: 'c' }, { a: 'Mango', b: 'mango' });
    expect(state.cowHolderId).toBe('c');
  });

  test('stays with its holder when they are the one alone again', () => {
    const state = reveal({ ...match(), cowHolderId: 'd' }, { a: 'Sol', b: 'sol', d: 'Luna' });
    expect(state.cowHolderId).toBe('d');
  });

  test('a holder who leaves drops it', () => {
    const state = dropManadaPlayer({ ...match(), cowHolderId: 'b' }, 'b');
    expect(state.cowHolderId).toBeNull();
  });
});

describe('merging groups', () => {
  const answers = { a: 'Mango', b: 'mango', c: 'Plátano', d: 'Banana', e: 'Piña' };

  test('a merge recomputes points and the cow from the round start', () => {
    const before = withTotals(match(), { a: 3, c: 2 }, 'b');
    const revealed = reveal(before, answers);
    expect(revealed.totals).toEqual({ a: 4, b: 1, c: 2, d: 0, e: 0 });
    expect(revealed.cowHolderId).toBe('b');

    const merged = mergeGroups(revealed, 'c', 'd');
    expect(groupsOf(merged)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
    expect(merged.lastResult?.groups[1]).toMatchObject({
      labels: ['Plátano', 'Banana'],
      merged: true,
    });
    expect(merged.totals).toEqual({ a: 3, b: 0, c: 2, d: 0, e: 0 });
    expect(merged.cowHolderId).toBe('e');
  });

  test('merges chain and never add twice', () => {
    const revealed = reveal(match(), answers);
    const chained = mergeGroups(mergeGroups(revealed, 'c', 'd'), 'e', 'c');
    expect(groupsOf(chained)).toEqual([
      ['c', 'd', 'e'],
      ['a', 'b'],
    ]);
    expect(chained.lastResult?.groups[0]?.labels).toEqual(['Plátano', 'Banana', 'Piña']);
    expect(chained.totals).toEqual({ a: 0, b: 0, c: 1, d: 1, e: 1 });
    expect(mergeGroups(chained, 'd', 'e')).toBe(chained);
  });

  test('splitting a merged group undoes its merges and recomputes', () => {
    const revealed = reveal(withTotals(match(), {}, 'b'), answers);
    const chained = mergeGroups(mergeGroups(revealed, 'c', 'd'), 'e', 'd');
    const split = splitGroup(chained, 'd');
    expect(split.lastResult?.groups).toEqual(revealed.lastResult?.groups);
    expect(split.totals).toEqual(revealed.totals);
    expect(split.cowHolderId).toBe(revealed.cowHolderId);
    expect(splitGroup(split, 'a')).toBe(split);
  });

  test('regrouping needs the reveal of that round and players with an answer', () => {
    const asking = match();
    expect(regroupProblem(asking, 1, ['a', 'b'])).toBe('STALE_ROUND');
    const revealed = reveal(asking, { a: 'Sol', b: 'Luna', c: 'Mar' });
    expect(regroupProblem(revealed, 2, ['a', 'b'])).toBe('STALE_ROUND');
    expect(regroupProblem(revealed, 1, ['a', 'e'])).toBe('TARGET_NOT_MEMBER');
    expect(regroupProblem(revealed, 1, ['a', 'b'])).toBeNull();
  });
});

describe('answering', () => {
  test('only a player of the open round answers, once', () => {
    const state = match(['a', 'b', 'c']);
    expect(manadaAnswerProblem(state, 'a', 1)).toBeNull();
    expect(manadaAnswerProblem(state, 'a', 2)).toBe('STALE_ROUND');
    expect(manadaAnswerProblem(state, 'z', 1)).toBe('NOT_IN_MATCH');
    expect(manadaAnswerProblem(recordAnswers(state, ['a']), 'a', 1)).toBe('ANSWER_CONFIRMED');
  });

  test('the round is complete when every player still in has answered', () => {
    const state = recordAnswers(match(['a', 'b', 'c']), ['a', 'b', 'z']);
    expect(state.answeredPlayerIds).toEqual(['a', 'b']);
    expect(allAnswersIn(state)).toBe(false);
    expect(allAnswersIn(recordAnswers(state, ['a', 'b', 'c']))).toBe(true);
  });

  test('the reveal counts only stored answers of players still in', () => {
    const state = dropManadaPlayer(match(), 'e');
    const revealed = revealManada(state, answered({ a: ' Sol ', b: 'sol', e: 'Sol' }));
    expect(revealed.lastResult?.answers).toEqual(answered({ a: 'Sol', b: 'sol' }));
    expect(revealed.answeredPlayerIds).toEqual(['a', 'b']);
  });
});

describe('winning', () => {
  const toEight: ManadaConfig = { goal: 'POINTS', rounds: 10 };

  test('until 8 points: ends when someone without the cow has 8 or more', () => {
    const state = withTotals(reveal(match(players, toEight), {}), { a: 8 });
    expect(manadaGoalReached(state)).toBe(true);
    expect(manadaWinners(state)).toEqual(['a']);
  });

  test('until 8 points: only the cow blocking keeps the match going', () => {
    const state = withTotals(reveal(match(players, toEight), {}), { a: 9, b: 7 }, 'a');
    expect(manadaGoalReached(state)).toBe(false);
  });

  test('until 8 points: several with 8 or more, the highest wins and ties share', () => {
    const state = withTotals(reveal(match(players, toEight), {}), { a: 9, b: 9, c: 8, d: 10 }, 'd');
    expect(manadaGoalReached(state)).toBe(true);
    expect(manadaWinners(state)).toEqual(['a', 'b']);
  });

  test('rounds: 8 points do not end the match before the last round', () => {
    const state = withTotals(reveal(match(), {}), { a: 12 });
    expect(manadaGoalReached(state)).toBe(false);
  });

  test('rounds run out: the highest score without the cow wins, ties shared', () => {
    let state = match(players, { goal: 'ROUNDS', rounds: 5 });
    while (state.round < 5) state = next(reveal(state, {}));
    const last = withTotals(reveal(state, {}), { a: 4, b: 6, c: 6, d: 7 }, 'd');
    expect(manadaGoalReached(last)).toBe(true);
    expect(finishManada(last)).toMatchObject({
      status: 'FINISHED',
      phase: 'FINISHED',
      winnerIds: ['b', 'c'],
    });
  });

  test('a departed player never wins', () => {
    const state = withTotals(match(), { a: 9, b: 3 });
    expect(manadaWinners(dropManadaPlayer(state, 'a'))).toEqual(['b']);
  });
});

describe('departures', () => {
  test('in the answer phase the leaver stops counting and can complete the round', () => {
    const state = dropManadaPlayer(recordAnswers(match(), ['a', 'b', 'c', 'd', 'e']), 'e');
    expect(state.answeredPlayerIds).toEqual(['a', 'b', 'c', 'd']);
    const waiting = dropManadaPlayer(recordAnswers(match(), ['a', 'b', 'c', 'd']), 'e');
    expect(allAnswersIn(waiting)).toBe(true);
  });

  test('in the reveal the leaver answer leaves the groups and the round recomputes', () => {
    const revealed = reveal(match(), { a: 'Sol', b: 'sol', c: 'Luna', d: 'luna', e: 'luna' });
    expect(revealed.totals).toMatchObject({ c: 1, d: 1, e: 1 });
    const state = dropManadaPlayer(revealed, 'e');
    expect(groupsOf(state)).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(state.totals).toEqual({ a: 0, b: 0, c: 0, d: 0, e: 0 });
  });

  test('a leaver who held the cow before the round drops it in the reveal', () => {
    const revealed = reveal(withTotals(match(), {}, 'e'), { a: 'Sol', b: 'Luna', c: 'Mar' });
    expect(revealed.cowHolderId).toBe('e');
    expect(dropManadaPlayer(revealed, 'e').cowHolderId).toBeNull();
  });

  test('the match ends with fewer than 2 players', () => {
    const state = dropManadaPlayer(
      dropManadaPlayer(withTotals(match(['a', 'b', 'c']), { a: 2 }), 'b'),
      'c',
    );
    expect(state).toMatchObject({ status: 'FINISHED', winnerIds: ['a'] });
  });

  test('someone who is not playing changes nothing', () => {
    const state = match(['a', 'b', 'c']);
    expect(dropManadaPlayer(state, 'z')).toBe(state);
  });
});

describe('night points', () => {
  test('the winners share first place, the rest follow by points, the cow among them', () => {
    const state = finishManada(withTotals(match(), { a: 6, b: 6, c: 9, d: 2, e: 2 }, 'c'));
    expect(state.winnerIds).toEqual(['a', 'b']);
    expect(manadaNightPoints(state)).toEqual({ a: 5, b: 5, c: 3, d: 2, e: 2 });
  });

  test('only players still in the match score', () => {
    const state = finishManada(dropManadaPlayer(withTotals(match(), { a: 5, e: 9 }), 'e'));
    expect(manadaNightPoints(state)).toEqual({ a: 4, b: 3, c: 3, d: 3 });
  });
});

describe('setup', () => {
  test('needs 3 players to start', () => {
    expect(manadaStartProblem(2)).toBe('NOT_ENOUGH_PLAYERS');
    expect(manadaStartProblem(3)).toBeNull();
  });

  test('rounds go from 5 to 15, or until 8 points', () => {
    expect(manadaConfigSchema.safeParse({ goal: 'ROUNDS', rounds: 5 }).success).toBe(true);
    expect(manadaConfigSchema.safeParse({ goal: 'POINTS', rounds: 15 }).success).toBe(true);
    expect(manadaConfigSchema.safeParse({ goal: 'ROUNDS', rounds: 4 }).success).toBe(false);
    expect(manadaConfigSchema.safeParse({ goal: 'ROUNDS', rounds: 16 }).success).toBe(false);
    expect(manadaConfigSchema.safeParse({ goal: 'FAST', rounds: 10 }).success).toBe(false);
  });

  test('questions do not repeat until the bank is used up', () => {
    const bank = [{ id: 'q1' }, { id: 'q2' }];
    const first: RandomInt = () => 0;
    expect(pickManadaQuestion(bank, ['q1'], first)).toEqual({
      question: { id: 'q2' },
      usedManadaQuestionIds: ['q1', 'q2'],
    });
    expect(pickManadaQuestion(bank, ['q1', 'q2'], first)).toEqual({
      question: { id: 'q1' },
      usedManadaQuestionIds: ['q1'],
    });
  });
});
