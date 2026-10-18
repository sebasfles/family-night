import {
  CIVILIAN_WIN_POINTS,
  IMPOSTOR_CAPS,
  IMPOSTOR_GUESS_OPTIONS,
  IMPOSTOR_WIN_POINTS,
  MIN_IMPOSTOR_PLAYERS,
} from '../constants.ts';
import type {
  Elimination,
  ImpostorConfig,
  ImpostorPublic,
  ImpostorWinner,
  TallyEntry,
  TieRule,
} from '../domain.ts';
import { shuffle, type RandomInt } from '../random.ts';

export interface Ballot {
  voterId: string;
  targetId: string;
}

export interface MatchFacts {
  word: string;
  category: string;
  options: string[];
  impostorIds: string[];
}

export type Outcome = 'CONTINUE' | 'GUESS' | ImpostorWinner;

export type StartProblem = 'NOT_ENOUGH_PLAYERS' | 'TOO_MANY_IMPOSTORS';

export function maxImpostors(playerCount: number): number {
  return IMPOSTOR_CAPS.find((cap) => playerCount >= cap.minPlayers)?.maxImpostors ?? 0;
}

export function startProblem(config: ImpostorConfig, playerCount: number): StartProblem | null {
  if (playerCount < MIN_IMPOSTOR_PLAYERS) return 'NOT_ENOUGH_PLAYERS';
  if (config.impostorCount > maxImpostors(playerCount)) return 'TOO_MANY_IMPOSTORS';
  return null;
}

export interface BankWord {
  id: string;
  category: string;
}

export function pickWord<W extends BankWord>(
  words: readonly W[],
  usedWordIds: readonly string[],
  categories: readonly string[],
  randomInt: RandomInt,
): { word: W; usedWordIds: string[] } {
  const active = words.filter((word) => categories.includes(word.category));
  const used = new Set(usedWordIds);
  let pool = active.filter((word) => !used.has(word.id));
  let kept = [...usedWordIds];
  if (pool.length === 0) {
    const activeIds = new Set(active.map((word) => word.id));
    kept = kept.filter((id) => !activeIds.has(id));
    pool = active;
  }
  const word = pool[randomInt(pool.length)];
  if (!word) throw new Error('no words in the active categories');
  return { word, usedWordIds: [...kept, word.id] };
}

export function guessOptions(
  word: string,
  categoryWords: readonly string[],
  randomInt: RandomInt,
): string[] {
  const others = shuffle(
    categoryWords.filter((other) => other !== word),
    randomInt,
  ).slice(0, IMPOSTOR_GUESS_OPTIONS - 1);
  return shuffle([word, ...others], randomInt);
}

export function startMatch(input: {
  matchId: string;
  config: ImpostorConfig;
  participants: readonly string[];
  randomInt: RandomInt;
}): { state: ImpostorPublic; impostorIds: string[] } {
  const { matchId, config, participants, randomInt } = input;
  const drawn = new Set(shuffle(participants, randomInt).slice(0, config.impostorCount));
  return {
    impostorIds: participants.filter((id) => drawn.has(id)),
    state: {
      gameType: 'IMPOSTOR',
      matchId,
      status: 'PLAYING',
      phase: 'VOTING',
      config,
      round: 1,
      participants: [...participants],
      order: config.randomOrder ? shuffle(participants, randomInt) : [...participants],
      eliminated: [],
      votedPlayerIds: [],
      lastResult: null,
      guess: null,
      winner: null,
      reveal: null,
    },
  };
}

export function isLiving(state: ImpostorPublic, playerId: string): boolean {
  return state.order.includes(playerId);
}

export function voteProblem(
  state: ImpostorPublic,
  voterId: string,
  targetId: string,
  round: number,
): 'STALE_ROUND' | 'INVALID_VOTE' | null {
  if (state.status !== 'PLAYING' || state.phase !== 'VOTING' || state.round !== round) {
    return 'STALE_ROUND';
  }
  if (voterId === targetId || !isLiving(state, voterId) || !isLiving(state, targetId)) {
    return 'INVALID_VOTE';
  }
  return null;
}

function countedBallots(state: ImpostorPublic, ballots: readonly Ballot[]): Ballot[] {
  return ballots.filter(
    (ballot) =>
      ballot.voterId !== ballot.targetId &&
      isLiving(state, ballot.voterId) &&
      isLiving(state, ballot.targetId),
  );
}

export function recordBallots(state: ImpostorPublic, ballots: readonly Ballot[]): ImpostorPublic {
  const voters = new Set(countedBallots(state, ballots).map((ballot) => ballot.voterId));
  return { ...state, votedPlayerIds: state.order.filter((id) => voters.has(id)) };
}

export function everyoneVoted(state: ImpostorPublic): boolean {
  return state.order.every((id) => state.votedPlayerIds.includes(id));
}

export function tallyVotes(state: ImpostorPublic, ballots: readonly Ballot[]): TallyEntry[] {
  const counted = countedBallots(state, ballots);
  return state.order
    .map((playerId) => ({
      playerId,
      votes: counted.filter((ballot) => ballot.targetId === playerId).length,
    }))
    .toSorted((a, b) => b.votes - a.votes);
}

export function resolveTally(
  tally: readonly TallyEntry[],
  tieRule: TieRule,
  randomInt: RandomInt,
): { eliminatedId: string | null; tie: boolean; reason: 'VOTE' | 'TIE_RANDOM' | null } {
  const top = tally[0]?.votes ?? 0;
  if (top === 0) return { eliminatedId: null, tie: false, reason: null };
  const leaders = tally.filter((entry) => entry.votes === top);
  const [only] = leaders;
  if (only && leaders.length === 1)
    return { eliminatedId: only.playerId, tie: false, reason: 'VOTE' };
  if (tieRule === 'SKIP') return { eliminatedId: null, tie: true, reason: null };
  const drawn = leaders[randomInt(leaders.length)];
  return { eliminatedId: drawn?.playerId ?? null, tie: true, reason: 'TIE_RANDOM' };
}

export function eliminate(
  state: ImpostorPublic,
  playerId: string,
  reason: Elimination['reason'],
  impostorIds: readonly string[],
): ImpostorPublic {
  return {
    ...state,
    order: state.order.filter((id) => id !== playerId),
    eliminated: [
      ...state.eliminated,
      { playerId, round: state.round, wasImpostor: impostorIds.includes(playerId), reason },
    ],
  };
}

export function closeVoting(
  state: ImpostorPublic,
  ballots: readonly Ballot[],
  impostorIds: readonly string[],
  randomInt: RandomInt,
): ImpostorPublic {
  const tally = tallyVotes(state, ballots);
  const result = resolveTally(tally, state.config.tieRule, randomInt);
  const revealed: ImpostorPublic = {
    ...recordBallots(state, ballots),
    phase: 'REVEAL',
    lastResult: { round: state.round, tally, tie: result.tie, eliminatedId: result.eliminatedId },
  };
  if (!result.eliminatedId || !result.reason) return revealed;
  return eliminate(revealed, result.eliminatedId, result.reason, impostorIds);
}

function lastImpostorOut(state: ImpostorPublic): Elimination | undefined {
  return state.eliminated.findLast((elimination) => elimination.wasImpostor);
}

export function outcome(state: ImpostorPublic): Outcome {
  const impostorsOut = state.eliminated.filter((elimination) => elimination.wasImpostor).length;
  const livingImpostors = state.config.impostorCount - impostorsOut;
  const livingCivilians = state.order.length - livingImpostors;
  if (livingImpostors <= 0) {
    const last = lastImpostorOut(state);
    const votedOut = last?.reason === 'VOTE' || last?.reason === 'TIE_RANDOM';
    return state.config.impostorLastGuess && votedOut ? 'GUESS' : 'CIVILIANS';
  }
  if (livingImpostors >= livingCivilians) return 'IMPOSTORS';
  return 'CONTINUE';
}

function isWinner(result: Outcome): result is ImpostorWinner {
  return result === 'CIVILIANS' || result === 'IMPOSTORS';
}

export function pendingGuesser(state: ImpostorPublic): string | null {
  if (state.phase === 'IMPOSTOR_GUESS') return state.guess?.guesserId ?? null;
  if (state.phase !== 'REVEAL' || outcome(state) !== 'GUESS') return null;
  return lastImpostorOut(state)?.playerId ?? null;
}

export function finish(
  state: ImpostorPublic,
  winner: ImpostorWinner,
  facts: MatchFacts,
): ImpostorPublic {
  return {
    ...state,
    status: 'FINISHED',
    phase: 'FINISHED',
    winner,
    reveal: { word: facts.word, category: facts.category, impostorIds: [...facts.impostorIds] },
  };
}

export function nextRound(state: ImpostorPublic, facts: MatchFacts): ImpostorPublic {
  const result = outcome(state);
  if (isWinner(result)) return finish(state, result, facts);
  if (result === 'GUESS') {
    const guesserId = pendingGuesser(state);
    if (!guesserId) return finish(state, 'CIVILIANS', facts);
    return {
      ...state,
      phase: 'IMPOSTOR_GUESS',
      guess: { guesserId, options: [...facts.options], chosen: null, correct: null },
    };
  }
  return {
    ...state,
    phase: 'VOTING',
    round: state.round + 1,
    votedPlayerIds: [],
    lastResult: null,
  };
}

export function submitGuess(
  state: ImpostorPublic,
  option: string,
  facts: MatchFacts,
): ImpostorPublic {
  const correct = option === facts.word;
  const finished = finish(state, correct ? 'IMPOSTORS' : 'CIVILIANS', facts);
  return state.guess
    ? { ...finished, guess: { ...state.guess, chosen: option, correct } }
    : finished;
}

export function skipGuess(state: ImpostorPublic, facts: MatchFacts): ImpostorPublic {
  return finish(state, 'CIVILIANS', facts);
}

export function removePlayer(input: {
  state: ImpostorPublic;
  playerId: string;
  reason: 'LEFT' | 'KICKED';
  facts: MatchFacts;
  ballots: readonly Ballot[];
  randomInt: RandomInt;
}): { state: ImpostorPublic; dropped: Ballot[] } {
  const { state, playerId, reason, facts, ballots, randomInt } = input;
  const unchanged = { state, dropped: [] };
  if (state.status !== 'PLAYING') return unchanged;
  if (pendingGuesser(state) === playerId) {
    return { state: finish(state, 'CIVILIANS', facts), dropped: [] };
  }
  if (!isLiving(state, playerId)) return unchanged;

  const remaining = eliminate(state, playerId, reason, facts.impostorIds);
  const result = outcome(remaining);
  if (state.phase !== 'VOTING') {
    return { state: isWinner(result) ? finish(remaining, result, facts) : remaining, dropped: [] };
  }

  const dropped = ballots.filter(
    (ballot) => ballot.voterId === playerId || ballot.targetId === playerId,
  );
  const kept = ballots.filter((ballot) => !dropped.includes(ballot));
  if (isWinner(result)) return { state: finish(remaining, result, facts), dropped };
  const synced = recordBallots(remaining, kept);
  return {
    state: everyoneVoted(synced) ? closeVoting(synced, kept, facts.impostorIds, randomInt) : synced,
    dropped,
  };
}

export function matchScores(
  state: ImpostorPublic,
  impostorIds: readonly string[],
): Record<string, number> {
  if (state.winner === 'IMPOSTORS') {
    return Object.fromEntries(impostorIds.map((id) => [id, IMPOSTOR_WIN_POINTS]));
  }
  if (state.winner === 'CIVILIANS') {
    return Object.fromEntries(
      state.participants
        .filter((id) => !impostorIds.includes(id))
        .map((id) => [id, CIVILIAN_WIN_POINTS]),
    );
  }
  return {};
}
