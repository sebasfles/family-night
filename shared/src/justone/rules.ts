import { MIN_JUST_ONE_ACTIVE, MIN_JUST_ONE_PLAYERS } from '../constants.ts';
import type {
  JustOneClue,
  JustOneConfig,
  JustOneOutcome,
  JustOnePublic,
  JustOneSkippedTurn,
} from '../domain.ts';
import { shuffle, type RandomInt } from '../random.ts';

const OUTCOME_POINTS: Record<JustOneOutcome, number> = { CORRECT: 1, PASS: 0, WRONG: -1 };

export function normalizeWord(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/ñ/g, 'ñ')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function wordForms(text: string): string[] {
  const base = normalizeWord(text);
  const forms = [base];
  if (base.endsWith('ces')) forms.push(`${base.slice(0, -3)}z`);
  if (base.endsWith('es')) forms.push(base.slice(0, -2));
  if (base.endsWith('s')) forms.push(base.slice(0, -1));
  return forms.filter((form) => form.length > 0);
}

export function sameWord(a: string, b: string): boolean {
  const others = new Set(wordForms(b));
  return wordForms(a).some((form) => others.has(form));
}

export function autoCancelled(clues: readonly JustOneClue[], word: string): string[] {
  return clues
    .filter(
      (clue) =>
        sameWord(clue.clue, word) ||
        clues.some((other) => other.authorId !== clue.authorId && sameWord(clue.clue, other.clue)),
    )
    .map((clue) => clue.authorId);
}

export function pickJustOneWord<W extends { id: string }>(
  bank: readonly W[],
  usedWordIds: readonly string[],
  randomInt: RandomInt,
): { word: W; usedJustOneWordIds: string[] } {
  const used = new Set(usedWordIds);
  const unseen = bank.filter((entry) => !used.has(entry.id));
  const exhausted = unseen.length === 0;
  const pool = exhausted ? bank : unseen;
  const word = pool[randomInt(pool.length)];
  if (!word) throw new Error('the Just One word bank is empty');
  return { word, usedJustOneWordIds: [...(exhausted ? [] : usedWordIds), word.id] };
}

export function justOneStartProblem(playerCount: number): 'NOT_ENOUGH_PLAYERS' | null {
  return playerCount < MIN_JUST_ONE_PLAYERS ? 'NOT_ENOUGH_PLAYERS' : null;
}

export function startJustOne(input: {
  matchId: string;
  config: JustOneConfig;
  participants: readonly string[];
  randomInt: RandomInt;
}): JustOnePublic {
  const { matchId, config, participants, randomInt } = input;
  const order = shuffle(participants, randomInt);
  const [guesserId] = order;
  if (!guesserId) throw new Error('a match needs participants');
  return {
    gameType: 'JUST_ONE',
    matchId,
    status: 'PLAYING',
    phase: 'CLUE',
    config,
    round: 1,
    turn: 0,
    participants: [...participants],
    order,
    departedIds: [],
    guesserId,
    committedPlayerIds: [],
    cancelledAuthorIds: [],
    clues: null,
    skipped: null,
    lastResult: null,
    score: 0,
    roundsWon: 0,
  };
}

export function isJustOnePlayer(state: JustOnePublic, playerId: string): boolean {
  return state.participants.includes(playerId) && !state.departedIds.includes(playerId);
}

export function justOnePlayers(state: JustOnePublic): string[] {
  return state.participants.filter((id) => !state.departedIds.includes(id));
}

export function clueGiversOf(state: JustOnePublic): string[] {
  return justOnePlayers(state).filter((id) => id !== state.guesserId);
}

export function isClueGiver(state: JustOnePublic, playerId: string): boolean {
  return clueGiversOf(state).includes(playerId);
}

export function justOneTotalTurns(state: JustOnePublic): number {
  return state.config.cycles * state.order.length;
}

export function guesserOfTurn(state: JustOnePublic, turn: number): string {
  const guesserId = state.order[turn % state.order.length];
  if (!guesserId) throw new Error('a match needs a guesser order');
  return guesserId;
}

export function nextJustOneTurn(state: JustOnePublic): number | null {
  for (let turn = state.turn + 1; turn < justOneTotalTurns(state); turn++) {
    if (isJustOnePlayer(state, guesserOfTurn(state, turn))) return turn;
  }
  return null;
}

export function openJustOneRound(
  state: JustOnePublic,
  turn: number,
  skipped: JustOneSkippedTurn | null = null,
): JustOnePublic {
  return {
    ...state,
    phase: 'CLUE',
    round: state.round + 1,
    turn,
    guesserId: guesserOfTurn(state, turn),
    committedPlayerIds: [],
    cancelledAuthorIds: [],
    clues: null,
    skipped,
    lastResult: null,
  };
}

export function isJustOneOpen(
  state: JustOnePublic,
  phases: readonly JustOnePublic['phase'][],
  round: number,
): boolean {
  return state.status === 'PLAYING' && phases.includes(state.phase) && state.round === round;
}

export function justOneClueProblem(
  state: JustOnePublic,
  callerId: string,
  round: number,
): 'STALE_ROUND' | 'NOT_CLUE_GIVER' | null {
  if (!isJustOneOpen(state, ['CLUE'], round)) return 'STALE_ROUND';
  return isClueGiver(state, callerId) ? null : 'NOT_CLUE_GIVER';
}

export function recordClues(state: JustOnePublic, authorIds: readonly string[]): JustOnePublic {
  const committed = new Set(authorIds);
  return { ...state, committedPlayerIds: clueGiversOf(state).filter((id) => committed.has(id)) };
}

export function allCluesIn(state: JustOnePublic): boolean {
  return clueGiversOf(state).every((id) => state.committedPlayerIds.includes(id));
}

function cluesBy(authorIds: readonly string[], clues: readonly JustOneClue[]): JustOneClue[] {
  return clues
    .filter((clue) => authorIds.includes(clue.authorId))
    .toSorted((a, b) => authorIds.indexOf(a.authorId) - authorIds.indexOf(b.authorId));
}

export function reviewedClues(state: JustOnePublic, clues: readonly JustOneClue[]): JustOneClue[] {
  return cluesBy(state.committedPlayerIds, clues);
}

export function openReview(
  state: JustOnePublic,
  clues: readonly JustOneClue[],
  word: string,
): JustOnePublic {
  const active = cluesBy(clueGiversOf(state), clues);
  const recorded = recordClues(
    state,
    active.map((clue) => clue.authorId),
  );
  return {
    ...recorded,
    phase: 'REVIEW',
    cancelledAuthorIds: autoCancelled(active, word),
    skipped: null,
  };
}

export function cancelClueProblem(
  state: JustOnePublic,
  callerId: string,
  round: number,
  authorId: string,
): 'STALE_ROUND' | 'NOT_CLUE_GIVER' | 'TARGET_NOT_MEMBER' | null {
  if (!isJustOneOpen(state, ['REVIEW'], round)) return 'STALE_ROUND';
  if (!isClueGiver(state, callerId)) return 'NOT_CLUE_GIVER';
  return state.committedPlayerIds.includes(authorId) ? null : 'TARGET_NOT_MEMBER';
}

export function setClueCancelled(
  state: JustOnePublic,
  authorId: string,
  cancelled: boolean,
): JustOnePublic {
  const others = state.cancelledAuthorIds.filter((id) => id !== authorId);
  const ids = new Set(cancelled ? [...others, authorId] : others);
  return { ...state, cancelledAuthorIds: state.committedPlayerIds.filter((id) => ids.has(id)) };
}

export function showCluesProblem(
  state: JustOnePublic,
  callerId: string,
  hostId: string,
  round: number,
): 'STALE_ROUND' | 'NOT_CLUE_GIVER' | null {
  if (!isJustOneOpen(state, ['REVIEW'], round)) return 'STALE_ROUND';
  return isClueGiver(state, callerId) || callerId === hostId ? null : 'NOT_CLUE_GIVER';
}

export function showClues(state: JustOnePublic, clues: readonly JustOneClue[]): JustOnePublic {
  const surviving = reviewedClues(state, clues).filter(
    (clue) => !state.cancelledAuthorIds.includes(clue.authorId),
  );
  return { ...state, phase: 'GUESS', clues: surviving };
}

export function justOneGuessProblem(
  state: JustOnePublic,
  callerId: string,
  round: number,
): 'STALE_ROUND' | 'INVALID_GUESS' | null {
  if (!isJustOneOpen(state, ['GUESS'], round)) return 'STALE_ROUND';
  return callerId === state.guesserId ? null : 'INVALID_GUESS';
}

export function guessOutcome(guess: string | null, word: string): JustOneOutcome {
  if (guess === null) return 'PASS';
  return sameWord(guess, word) ? 'CORRECT' : 'WRONG';
}

export function scoreAfter(scoreBefore: number, outcome: JustOneOutcome): number {
  return Math.max(0, scoreBefore + OUTCOME_POINTS[outcome]);
}

export function revealJustOne(
  state: JustOnePublic,
  input: { word: string; guess: string | null; clues: readonly JustOneClue[] },
): JustOnePublic {
  const outcome = guessOutcome(input.guess, input.word);
  const score = scoreAfter(state.score, outcome);
  return {
    ...state,
    phase: 'REVEAL',
    lastResult: {
      round: state.round,
      guesserId: state.guesserId,
      word: input.word,
      guess: input.guess,
      outcome,
      accepted: false,
      clues: reviewedClues(state, input.clues).map((clue) => ({
        ...clue,
        cancelled: state.cancelledAuthorIds.includes(clue.authorId),
      })),
      scoreBefore: state.score,
      score,
    },
    score,
    roundsWon: state.roundsWon + (outcome === 'CORRECT' ? 1 : 0),
  };
}

export function acceptGuessProblem(state: JustOnePublic, round: number): 'STALE_ROUND' | null {
  if (!isJustOneOpen(state, ['REVEAL'], round)) return 'STALE_ROUND';
  return state.lastResult?.round === round && state.lastResult.outcome === 'WRONG'
    ? null
    : 'STALE_ROUND';
}

export function acceptGuess(state: JustOnePublic): JustOnePublic {
  const result = state.lastResult;
  if (!result) throw new Error('a reveal needs a result');
  const score = scoreAfter(result.scoreBefore, 'CORRECT');
  return {
    ...state,
    lastResult: { ...result, outcome: 'CORRECT', accepted: true, score },
    score,
    roundsWon: state.roundsWon + 1,
  };
}

export function finishJustOne(state: JustOnePublic): JustOnePublic {
  return { ...state, status: 'FINISHED', phase: 'FINISHED' };
}

export function dropJustOnePlayer(
  state: JustOnePublic,
  playerId: string,
): { state: JustOnePublic; cancelsRound: boolean } {
  if (state.status !== 'PLAYING' || !isJustOnePlayer(state, playerId)) {
    return { state, cancelsRound: false };
  }
  const keepsClue = state.phase === 'GUESS' || state.phase === 'REVEAL';
  const dropped: JustOnePublic = {
    ...state,
    departedIds: [...state.departedIds, playerId],
    ...(keepsClue
      ? {}
      : {
          committedPlayerIds: state.committedPlayerIds.filter((id) => id !== playerId),
          cancelledAuthorIds: state.cancelledAuthorIds.filter((id) => id !== playerId),
        }),
  };
  if (justOnePlayers(dropped).length < MIN_JUST_ONE_ACTIVE) {
    return { state: finishJustOne(dropped), cancelsRound: false };
  }
  const cancelsRound = playerId === state.guesserId && state.phase !== 'REVEAL';
  return { state: dropped, cancelsRound };
}

export function justOneScores(state: JustOnePublic): Record<string, number> {
  if (state.score === 0) return {};
  return Object.fromEntries(justOnePlayers(state).map((id) => [id, state.score]));
}
