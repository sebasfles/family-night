import {
  MANADA_ANSWER_MAX,
  MANADA_ANSWER_MAX_WORDS,
  MANADA_ROUND_LIMIT,
  MANADA_WIN_POINTS,
  MIN_MANADA_ACTIVE,
  MIN_MANADA_PLAYERS,
} from '../constants.ts';
import type {
  ManadaAnswer,
  ManadaConfig,
  ManadaGroup,
  ManadaPublic,
  ManadaQuestion,
  ManadaResult,
} from '../domain.ts';
import { normalizeWord, sameWord } from '../justone/rules.ts';
import type { RandomInt } from '../random.ts';
import { podiumPoints } from '../scoring.ts';

type Phase = ManadaPublic['phase'];
type RoundBase = Omit<ManadaResult, 'groups'>;

const ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);

export function cleanAnswer(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

export function isManadaAnswer(text: string): boolean {
  const clean = cleanAnswer(text);
  return (
    clean.length > 0 &&
    clean.length <= MANADA_ANSWER_MAX &&
    clean.split(' ').length <= MANADA_ANSWER_MAX_WORDS &&
    normalizeWord(clean).length > 0
  );
}

function answerWords(text: string): string[] {
  const words = cleanAnswer(text)
    .split(' ')
    .map(normalizeWord)
    .filter((word) => word.length > 0);
  const [first] = words;
  return words.length > 1 && first !== undefined && ARTICLES.has(first) ? words.slice(1) : words;
}

export function sameAnswer(a: string, b: string): boolean {
  const left = answerWords(a);
  const right = answerWords(b);
  return left.length === right.length && left.every((word, i) => sameWord(word, right[i] ?? ''));
}

class DisjointSets {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i: number): number {
    const parent = this.parent[i] ?? i;
    if (parent === i) return i;
    const root = this.find(parent);
    this.parent[i] = root;
    return root;
  }

  union(a: number, b: number): void {
    const [rootA, rootB] = [this.find(a), this.find(b)];
    if (rootA !== rootB) this.parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
  }
}

export function groupAnswers(
  answers: readonly ManadaAnswer[],
  merges: readonly (readonly string[])[],
): ManadaGroup[] {
  const sets = new DisjointSets(answers.length);
  answers.forEach((a, i) => {
    answers.slice(i + 1).forEach((b, offset) => {
      if (sameAnswer(a.answer, b.answer)) sets.union(i, i + 1 + offset);
    });
  });
  const autoRoots = answers.map((_, i) => sets.find(i));
  for (const merge of merges) {
    const members = answers.flatMap((answer, i) => (merge.includes(answer.playerId) ? [i] : []));
    for (const i of members) sets.union(members[0] ?? i, i);
  }

  const byRoot = new Map<number, number[]>();
  answers.forEach((_, i) => {
    const root = sets.find(i);
    byRoot.set(root, [...(byRoot.get(root) ?? []), i]);
  });
  const groups = [...byRoot.values()].map((members) => {
    const autos = [...new Set(members.map((i) => autoRoots[i] ?? i))];
    const ids = members.map((i) => answers[i]?.playerId ?? '');
    return {
      first: members[0] ?? 0,
      group: {
        id: ids[0] ?? '',
        playerIds: ids,
        labels: autos.map((i) => cleanAnswer(answers[i]?.answer ?? '')),
        merged: autos.length > 1,
        points: 0,
      },
    };
  });
  const sorted = groups
    .toSorted((a, b) => b.group.playerIds.length - a.group.playerIds.length || a.first - b.first)
    .map(({ group }) => group);

  const largest = sorted[0]?.playerIds.length ?? 0;
  const leaders = sorted.filter((group) => group.playerIds.length === largest);
  const scoring = largest >= 2 && leaders.length === 1 ? leaders[0] : undefined;
  return sorted.map((group) => (group === scoring ? { ...group, points: 1 } : group));
}

export function loneAnswererId(groups: readonly ManadaGroup[]): string | null {
  const herd = groups.some((group) => group.playerIds.length >= 2);
  const solos = groups.filter((group) => group.playerIds.length === 1);
  return herd && solos.length === 1 ? (solos[0]?.playerIds[0] ?? null) : null;
}

function resolveRound(state: ManadaPublic, base: RoundBase): ManadaPublic {
  const groups = groupAnswers(base.answers, base.merges);
  const totals = { ...base.totalsBefore };
  for (const group of groups) {
    for (const id of group.playerIds) totals[id] = (totals[id] ?? 0) + group.points;
  }
  return {
    ...state,
    lastResult: { ...base, groups },
    totals,
    cowHolderId: loneAnswererId(groups) ?? base.cowBefore,
  };
}

export function pickManadaQuestion<Q extends { id: string }>(
  bank: readonly Q[],
  usedQuestionIds: readonly string[],
  randomInt: RandomInt,
): { question: Q; usedManadaQuestionIds: string[] } {
  const used = new Set(usedQuestionIds);
  const unseen = bank.filter((entry) => !used.has(entry.id));
  const exhausted = unseen.length === 0;
  const pool = exhausted ? bank : unseen;
  const question = pool[randomInt(pool.length)];
  if (!question) throw new Error('the La manada question bank is empty');
  return {
    question,
    usedManadaQuestionIds: [...(exhausted ? [] : usedQuestionIds), question.id],
  };
}

export function manadaStartProblem(playerCount: number): 'NOT_ENOUGH_PLAYERS' | null {
  return playerCount < MIN_MANADA_PLAYERS ? 'NOT_ENOUGH_PLAYERS' : null;
}

export function startManada(input: {
  matchId: string;
  config: ManadaConfig;
  participants: readonly string[];
  question: ManadaQuestion;
}): ManadaPublic {
  const { matchId, config, participants, question } = input;
  return {
    gameType: 'MANADA',
    matchId,
    status: 'PLAYING',
    phase: 'ANSWER',
    config,
    round: 1,
    participants: [...participants],
    departedIds: [],
    question,
    answeredPlayerIds: [],
    lastResult: null,
    totals: Object.fromEntries(participants.map((id) => [id, 0])),
    cowHolderId: null,
    winnerIds: [],
  };
}

export function isManadaPlayer(state: ManadaPublic, playerId: string): boolean {
  return state.participants.includes(playerId) && !state.departedIds.includes(playerId);
}

export function manadaPlayers(state: ManadaPublic): string[] {
  return state.participants.filter((id) => !state.departedIds.includes(id));
}

export function isManadaOpen(
  state: ManadaPublic,
  phases: readonly Phase[],
  round: number,
): boolean {
  return state.status === 'PLAYING' && phases.includes(state.phase) && state.round === round;
}

export function manadaAnswerProblem(
  state: ManadaPublic,
  callerId: string,
  round: number,
): 'STALE_ROUND' | 'NOT_IN_MATCH' | 'ANSWER_CONFIRMED' | null {
  if (!isManadaOpen(state, ['ANSWER'], round)) return 'STALE_ROUND';
  if (!isManadaPlayer(state, callerId)) return 'NOT_IN_MATCH';
  return state.answeredPlayerIds.includes(callerId) ? 'ANSWER_CONFIRMED' : null;
}

export function recordAnswers(state: ManadaPublic, authorIds: readonly string[]): ManadaPublic {
  const answered = new Set(authorIds);
  return { ...state, answeredPlayerIds: manadaPlayers(state).filter((id) => answered.has(id)) };
}

export function allAnswersIn(state: ManadaPublic): boolean {
  return manadaPlayers(state).every((id) => state.answeredPlayerIds.includes(id));
}

export function revealManada(state: ManadaPublic, stored: readonly ManadaAnswer[]): ManadaPublic {
  const byPlayer = new Map(stored.map((answer) => [answer.playerId, answer.answer]));
  const answers = manadaPlayers(state).flatMap((playerId) => {
    const answer = byPlayer.get(playerId);
    return answer === undefined ? [] : [{ playerId, answer: cleanAnswer(answer) }];
  });
  const revealed: ManadaPublic = {
    ...state,
    phase: 'REVEAL',
    answeredPlayerIds: answers.map((answer) => answer.playerId),
  };
  return resolveRound(revealed, {
    round: state.round,
    answers,
    merges: [],
    totalsBefore: state.totals,
    cowBefore: state.cowHolderId,
  });
}

export function groupOf(state: ManadaPublic, playerId: string): ManadaGroup | undefined {
  return state.lastResult?.groups.find((group) => group.playerIds.includes(playerId));
}

export function regroupProblem(
  state: ManadaPublic,
  round: number,
  groupIds: readonly string[],
): 'STALE_ROUND' | 'TARGET_NOT_MEMBER' | null {
  if (!isManadaOpen(state, ['REVEAL'], round) || state.lastResult?.round !== round) {
    return 'STALE_ROUND';
  }
  return groupIds.every((id) => groupOf(state, id)) ? null : 'TARGET_NOT_MEMBER';
}

export function mergeGroups(state: ManadaPublic, a: string, b: string): ManadaPublic {
  const result = state.lastResult;
  const [first, second] = [groupOf(state, a), groupOf(state, b)];
  if (!result || !first || !second || first.id === second.id) return state;
  const merge = [...first.playerIds, ...second.playerIds];
  return resolveRound(state, { ...result, merges: [...result.merges, merge] });
}

export function splitGroup(state: ManadaPublic, groupId: string): ManadaPublic {
  const result = state.lastResult;
  const group = groupOf(state, groupId);
  if (!result || !group?.merged) return state;
  const merges = result.merges.filter((merge) => !merge.some((id) => group.playerIds.includes(id)));
  return resolveRound(state, { ...result, merges });
}

export function manadaLastRound(config: ManadaConfig): number {
  return config.goal === 'ROUNDS' ? config.rounds : MANADA_ROUND_LIMIT;
}

export function manadaGoalReached(state: ManadaPublic): boolean {
  if (state.round >= manadaLastRound(state.config)) return true;
  return (
    state.config.goal === 'POINTS' &&
    manadaPlayers(state).some(
      (id) => id !== state.cowHolderId && (state.totals[id] ?? 0) >= MANADA_WIN_POINTS,
    )
  );
}

export function manadaWinners(state: ManadaPublic): string[] {
  const contenders = manadaPlayers(state).filter((id) => id !== state.cowHolderId);
  const best = Math.max(...contenders.map((id) => state.totals[id] ?? 0));
  return contenders.filter((id) => (state.totals[id] ?? 0) === best);
}

export function finishManada(state: ManadaPublic): ManadaPublic {
  return { ...state, status: 'FINISHED', phase: 'FINISHED', winnerIds: manadaWinners(state) };
}

export function openManadaRound(state: ManadaPublic, question: ManadaQuestion): ManadaPublic {
  return {
    ...state,
    phase: 'ANSWER',
    round: state.round + 1,
    question,
    answeredPlayerIds: [],
    lastResult: null,
  };
}

export function dropManadaPlayer(state: ManadaPublic, playerId: string): ManadaPublic {
  if (state.status !== 'PLAYING' || !isManadaPlayer(state, playerId)) return state;
  const dropped: ManadaPublic = {
    ...state,
    departedIds: [...state.departedIds, playerId],
    answeredPlayerIds: state.answeredPlayerIds.filter((id) => id !== playerId),
    cowHolderId: state.cowHolderId === playerId ? null : state.cowHolderId,
  };
  const result = state.lastResult;
  const recomputed =
    state.phase === 'REVEAL' && result
      ? resolveRound(dropped, {
          ...result,
          answers: result.answers.filter((answer) => answer.playerId !== playerId),
          cowBefore: result.cowBefore === playerId ? null : result.cowBefore,
        })
      : dropped;
  return manadaPlayers(recomputed).length < MIN_MANADA_ACTIVE
    ? finishManada(recomputed)
    : recomputed;
}

export function manadaNightPoints(state: ManadaPublic): Record<string, number> {
  const ranking: Record<string, number> = { ...state.totals };
  for (const id of state.winnerIds) ranking[id] = Number.POSITIVE_INFINITY;
  return podiumPoints(ranking, manadaPlayers(state));
}
