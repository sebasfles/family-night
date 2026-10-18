import {
  closeVoting,
  everyoneConfirmed,
  matchScores,
  maxImpostors,
  nextRound,
  pickWord,
  recordBallots,
  removePlayer,
  startMatch,
  startProblem,
  voteProblem,
  type Ballot,
  type ImpostorConfig,
  type ImpostorPublic,
  type MatchFacts,
  type MatchSecret,
  type RoomSnapshot,
  type RoundRequest,
  type VoteRequest,
} from '@family-night/shared';
import { impostorConfigSchema } from '@family-night/shared/schemas';
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
import type { DepartureReason, GameModule, PrepareInput } from '../games.ts';
import {
  applyMatchUpdate,
  callerChange,
  gameState,
  matchCommand,
  requireCurrentMatch,
  type MatchUpdate,
} from '../matches/match-change.ts';
import { updateRoom } from '../room-state.ts';
import { bankEntries, defaultImpostorConfig, isKnownCategory } from './words.ts';

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

export function prepareImpostor(deps: Deps, input: PrepareInput<ImpostorConfig>): MatchUpdate {
  const { matchId, config, participants, room, nowMs } = input;
  const randomInt = deps.secureRandomInt;
  const picked = pickWord(bankEntries, room.usedWordIds, config.categories, randomInt);
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
    impostorIds: item.impostorIds,
  };
}

function toBallot(vote: VoteItem): Ballot {
  return { voterId: vote.voterId, targetId: vote.targetId, confirmed: vote.confirmed === true };
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
  reason: DepartureReason,
  nowMs: number,
): Promise<MatchUpdate | null> {
  const before = gameState(match, 'IMPOSTOR');
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

async function roundBallots(deps: Deps, match: MatchItem, nowMs: number): Promise<Ballot[]> {
  const { matchId, publicState } = match;
  return (await deps.repos.votes.listRound(matchId, publicState.round, nowMs)).map(toBallot);
}

export async function castVote(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, targetId, confirmed }: VoteRequest,
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
  const problem = voteProblem(gameState(match, 'IMPOSTOR'), player.playerId, targetId, round);
  if (problem) throw new AppError(problem);
  const written = await deps.repos.votes.putUnlessConfirmed({
    matchId,
    round,
    voterId: player.playerId,
    targetId,
    confirmed,
    createdAt: iso(nowMs),
    ttl: ttlFrom(nowMs),
  });
  if (!written) {
    const locked = await deps.repos.votes.get(matchId, round, player.playerId, nowMs);
    if (!locked) throw new AppError('CONFLICT');
    if (!confirmed || locked.targetId !== targetId) throw new AppError('VOTE_CONFIRMED');
  }

  return updateRoom(deps, roomCode, async (state, now) => {
    const change = callerChange(state, player.playerId, now, 'member');
    const current = await requireCurrentMatch(deps, state, matchId, now);
    const before = gameState(current, 'IMPOSTOR');
    if (before.phase !== 'VOTING' || before.round !== round) {
      if (before.round === round && before.votedPlayerIds.includes(player.playerId)) return change;
      throw new AppError('STALE_ROUND');
    }
    const ballots = await roundBallots(deps, current, now);
    const recorded = recordBallots(before, ballots);
    if (!everyoneConfirmed(recorded))
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
    const before = gameState(match, 'IMPOSTOR');
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

async function impostorNextRound(
  deps: Deps,
  match: MatchItem,
  round: number,
  nowMs: number,
): Promise<MatchUpdate> {
  const before = gameState(match, 'IMPOSTOR');
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
}

async function impostorSecret(
  deps: Deps,
  match: MatchItem,
  playerId: string,
  nowMs: number,
): Promise<MatchSecret | null> {
  const item = await deps.repos.matchSecrets.getPlayer(match.matchId, playerId, nowMs);
  return item?.secret ?? null;
}

export const impostorGame: GameModule<'IMPOSTOR'> = {
  defaultConfig: defaultImpostorConfig,
  parseConfig: parseImpostorConfig,
  checkStart: checkImpostorStart,
  prepare: prepareImpostor,
  nextRound: (deps, match, round, _room, nowMs) => impostorNextRound(deps, match, round, nowMs),
  departure: (deps, match, playerId, reason, _room, nowMs) =>
    impostorDeparture(deps, match, playerId, reason, nowMs),
  secret: impostorSecret,
};
