import {
  closeVoting,
  everyoneVoted,
  guessOptions,
  impostorConfigSchema,
  matchScores,
  maxImpostors,
  nextRound,
  pickWord,
  recordBallots,
  removePlayer,
  skipGuess,
  startMatch,
  startProblem,
  submitGuess,
  voteProblem,
  type Ballot,
  type GuessRequest,
  type ImpostorConfig,
  type ImpostorPublic,
  type MatchFacts,
  type RoomSnapshot,
  type RoundRequest,
  type VoteRequest,
} from '@family-night/shared';
import type { Deps } from '../../deps.ts';
import { AppError } from '../../lib/errors.ts';
import { iso, ttlFrom } from '../../lib/time.ts';
import type { TransactItem } from '../../repos/db.ts';
import {
  MATCH_KEY,
  type MatchSecretItem,
  type PlayerSecretItem,
} from '../../repos/match-secrets.ts';
import type { MatchItem } from '../../repos/matches.ts';
import type { PlayerItem } from '../../repos/players.ts';
import type { VoteItem } from '../../repos/votes.ts';
import {
  applyMatchUpdate,
  callerChange,
  requireCurrentMatch,
  type MatchUpdate,
} from '../matches/match-change.ts';
import { updateRoom } from '../room-state.ts';
import { bankEntries, categoryWords, isKnownCategory } from './words.ts';

export function parseImpostorConfig(raw: unknown): ImpostorConfig {
  const parsed = impostorConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const noCategory = parsed.error.issues.some(
      (issue) => issue.path[0] === 'categories' && issue.code === 'too_small',
    );
    throw new AppError(
      'INVALID_CONFIG',
      details,
      noCategory ? 'Elige al menos una categoría' : undefined,
    );
  }
  if (!parsed.data.categories.every(isKnownCategory)) {
    throw new AppError('INVALID_CONFIG', undefined, 'Una de las categorías ya no existe');
  }
  return parsed.data;
}

export function checkImpostorStart(config: ImpostorConfig, playerCount: number): void {
  const problem = startProblem(config, playerCount);
  if (problem === 'NOT_ENOUGH_PLAYERS') throw new AppError('NOT_ENOUGH_PLAYERS');
  if (problem === 'TOO_MANY_IMPOSTORS') {
    const max = maxImpostors(playerCount);
    throw new AppError(
      'INVALID_CONFIG',
      undefined,
      `Con ${String(playerCount)} jugadores puede haber como máximo ${String(max)} ${max === 1 ? 'impostor' : 'impostores'}`,
    );
  }
}

export function prepareImpostor(
  deps: Deps,
  input: {
    matchId: string;
    config: ImpostorConfig;
    participants: string[];
    usedWordIds: string[];
    nowMs: number;
  },
): { publicState: ImpostorPublic; usedWordIds: string[]; writes: TransactItem[] } {
  const { matchId, config, participants, nowMs } = input;
  const randomInt = deps.secureRandomInt;
  const picked = pickWord(bankEntries, input.usedWordIds, config.categories, randomInt);
  const entry = picked.word;
  const { state, impostorIds } = startMatch({ matchId, config, participants, randomInt });
  const ttl = ttlFrom(nowMs);
  const secrets: PlayerSecretItem[] = participants.map((playerId) => ({
    matchId,
    playerId,
    ttl,
    secret: impostorIds.includes(playerId)
      ? {
          role: 'IMPOSTOR',
          clue: entry.clue,
          category: config.showCategoryToImpostor ? entry.categoryName : null,
        }
      : { role: 'CIVILIAN', word: entry.word, category: entry.categoryName },
  }));
  const facts: MatchSecretItem = {
    matchId,
    playerId: MATCH_KEY,
    wordId: entry.id,
    word: entry.word,
    category: entry.categoryName,
    clue: entry.clue,
    options: guessOptions(entry.word, categoryWords(entry.category), randomInt),
    impostorIds,
    ttl,
  };
  return {
    publicState: state,
    usedWordIds: picked.usedWordIds,
    writes: [...secrets, facts].map((item) => deps.repos.matchSecrets.putItem(item)),
  };
}

async function loadFacts(deps: Deps, matchId: string, nowMs: number): Promise<MatchFacts> {
  const item = await deps.repos.matchSecrets.getMatch(matchId, nowMs);
  if (!item) throw new Error(`match ${matchId} has no secrets`);
  return {
    word: item.word,
    category: item.category,
    options: item.options,
    impostorIds: item.impostorIds,
  };
}

function toBallot(vote: VoteItem): Ballot {
  return { voterId: vote.voterId, targetId: vote.targetId };
}

function withScores(
  before: ImpostorPublic,
  after: ImpostorPublic,
  facts: MatchFacts,
  writes: TransactItem[] = [],
): MatchUpdate {
  const finished = before.status === 'PLAYING' && after.status === 'FINISHED';
  return {
    publicState: after,
    writes,
    ...(finished ? { scores: matchScores(after, facts.impostorIds) } : {}),
  };
}

export async function impostorDeparture(
  deps: Deps,
  match: MatchItem,
  playerId: string,
  reason: 'LEFT' | 'KICKED',
  nowMs: number,
): Promise<MatchUpdate | null> {
  const before = match.publicState;
  if (before.status !== 'PLAYING') return null;
  const facts = await loadFacts(deps, match.matchId, nowMs);
  const votes =
    before.phase === 'VOTING'
      ? await deps.repos.votes.listRound(match.matchId, before.round, nowMs)
      : [];
  const ballots = votes.map(toBallot);
  const { state, dropped } = removePlayer({
    state: before,
    playerId,
    reason,
    facts,
    ballots,
    randomInt: deps.secureRandomInt,
  });
  if (state === before) return null;
  const writes = votes
    .filter((vote) => dropped.some((ballot) => ballot.voterId === vote.voterId))
    .map((vote) => deps.repos.votes.deleteItem(vote));
  return withScores(before, state, facts, writes);
}

type MatchAction = (match: MatchItem, nowMs: number) => Promise<MatchUpdate>;

function matchCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  role: 'member' | 'host',
  act: MatchAction,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, async (state, nowMs) => {
    const change = callerChange(state, player.playerId, nowMs, role);
    const match = await requireCurrentMatch(deps, state, matchId, nowMs);
    return applyMatchUpdate(change, match, await act(match, nowMs), nowMs);
  });
}

async function roundBallots(deps: Deps, match: MatchItem, nowMs: number): Promise<Ballot[]> {
  const { matchId, publicState } = match;
  return (await deps.repos.votes.listRound(matchId, publicState.round, nowMs)).map(toBallot);
}

export async function castVote(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, targetId }: VoteRequest,
): Promise<RoomSnapshot> {
  const nowMs = deps.clock();
  const [room, member] = await Promise.all([
    deps.repos.rooms.get(roomCode, nowMs),
    deps.repos.roomMembers.get(roomCode, player.playerId, nowMs),
  ]);
  if (!room) throw new AppError('ROOM_NOT_FOUND');
  if (!member) throw new AppError('NOT_MEMBER');
  const match = await deps.repos.matches.get(roomCode, matchId, nowMs);
  if (!match) throw new AppError('MATCH_NOT_FOUND');
  if (room.currentMatchId !== matchId) throw new AppError('STALE_ROUND');
  const problem = voteProblem(match.publicState, player.playerId, targetId, round);
  if (problem) throw new AppError(problem);
  await deps.repos.votes.put({
    matchId,
    round,
    voterId: player.playerId,
    targetId,
    createdAt: iso(nowMs),
    ttl: ttlFrom(nowMs),
  });

  return updateRoom(deps, roomCode, async (state, now) => {
    const change = callerChange(state, player.playerId, now, 'member');
    const current = await requireCurrentMatch(deps, state, matchId, now);
    const before = current.publicState;
    if (before.phase !== 'VOTING' || before.round !== round) {
      if (before.round === round && before.votedPlayerIds.includes(player.playerId)) return change;
      throw new AppError('STALE_ROUND');
    }
    const ballots = await roundBallots(deps, current, now);
    const recorded = recordBallots(before, ballots);
    if (!everyoneVoted(recorded))
      return applyMatchUpdate(change, current, { publicState: recorded }, now);
    const facts = await loadFacts(deps, matchId, now);
    const closed = closeVoting(recorded, ballots, facts.impostorIds, deps.secureRandomInt);
    return applyMatchUpdate(change, current, { publicState: closed }, now);
  });
}

export function closeVotingCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', async (match, nowMs) => {
    const before = match.publicState;
    if (before.status !== 'PLAYING' || before.phase !== 'VOTING' || before.round !== round) {
      throw new AppError('STALE_ROUND');
    }
    const ballots = await roundBallots(deps, match, nowMs);
    const facts = await loadFacts(deps, match.matchId, nowMs);
    return {
      publicState: closeVoting(
        recordBallots(before, ballots),
        ballots,
        facts.impostorIds,
        deps.secureRandomInt,
      ),
    };
  });
}

export function nextRoundCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', async (match, nowMs) => {
    const before = match.publicState;
    if (before.status !== 'PLAYING' || before.phase !== 'REVEAL' || before.round !== round) {
      throw new AppError('STALE_ROUND');
    }
    const facts = await loadFacts(deps, match.matchId, nowMs);
    const after = nextRound(before, facts);
    const cleared =
      after.phase === 'VOTING'
        ? (await deps.repos.votes.listRound(match.matchId, before.round, nowMs)).map((vote) =>
            deps.repos.votes.deleteItem(vote),
          )
        : [];
    return withScores(before, after, facts, cleared);
  });
}

export function guessCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { option }: GuessRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'member', async (match, nowMs) => {
    const before = match.publicState;
    if (before.status !== 'PLAYING' || before.phase !== 'IMPOSTOR_GUESS' || !before.guess) {
      throw new AppError('STALE_ROUND');
    }
    if (before.guess.guesserId !== player.playerId) throw new AppError('NOT_GUESSER');
    if (!before.guess.options.includes(option)) throw new AppError('VALIDATION_ERROR');
    const facts = await loadFacts(deps, match.matchId, nowMs);
    return withScores(before, submitGuess(before, option, facts), facts);
  });
}

export function skipGuessCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', async (match, nowMs) => {
    const before = match.publicState;
    if (before.status !== 'PLAYING' || before.phase !== 'IMPOSTOR_GUESS') {
      throw new AppError('STALE_ROUND');
    }
    const facts = await loadFacts(deps, match.matchId, nowMs);
    return withScores(before, skipGuess(before, facts), facts);
  });
}
