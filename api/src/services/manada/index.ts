import {
  allAnswersIn,
  cleanAnswer,
  dropManadaPlayer,
  finishManada,
  isManadaOpen,
  isManadaPlayer,
  manadaAnswerProblem,
  manadaGoalReached,
  manadaNightPoints,
  manadaStartProblem,
  mergeGroups,
  openManadaRound,
  pickManadaQuestion,
  recordAnswers,
  regroupProblem,
  revealManada,
  splitGroup,
  startManada,
  MANADA_DEFAULTS,
  MIN_MANADA_PLAYERS,
  type ManadaAnswer,
  type ManadaAnswerRequest,
  type ManadaConfig,
  type ManadaPublic,
  type MatchSecret,
  type MergeGroupsRequest,
  type RoomSnapshot,
  type RoundRequest,
  type SplitGroupRequest,
} from '@family-night/shared';
import { manadaConfigSchema } from '@family-night/shared/schemas';
import type { Deps } from '../../deps.ts';
import { AppError, notEnoughPlayers } from '../../lib/errors.ts';
import { iso, ttlFrom } from '../../lib/time.ts';
import type { AnswerItem } from '../../repos/match-secrets.ts';
import type { MatchItem } from '../../repos/matches.ts';
import type { PlayerItem } from '../../repos/players.ts';
import type { RoomItem } from '../../repos/rooms.ts';
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
import { manadaQuestions } from './questions.ts';

type Phase = ManadaPublic['phase'];

function parseManadaConfig(raw: unknown): ManadaConfig {
  const parsed = manadaConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      'INVALID_CONFIG',
      parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return parsed.data;
}

function checkManadaStart(_config: ManadaConfig, playerCount: number): void {
  if (manadaStartProblem(playerCount)) throw notEnoughPlayers(MIN_MANADA_PLAYERS);
}

function pickQuestion(deps: Deps, room: RoomItem) {
  return pickManadaQuestion(manadaQuestions, room.usedManadaQuestionIds, deps.secureRandomInt);
}

function prepareManada(deps: Deps, input: PrepareInput<ManadaConfig>): MatchUpdate {
  const { matchId, config, participants, room } = input;
  const picked = pickQuestion(deps, room);
  return {
    publicState: startManada({ matchId, config, participants, question: picked.question }),
    usedManadaQuestionIds: picked.usedManadaQuestionIds,
  };
}

function settled(before: ManadaPublic, after: ManadaPublic): MatchUpdate {
  const ended = before.status === 'PLAYING' && after.status === 'FINISHED';
  return { publicState: after, ...(ended ? { scores: manadaNightPoints(after) } : {}) };
}

function requireOpen(state: ManadaPublic, phases: readonly Phase[], round: number): void {
  if (!isManadaOpen(state, phases, round)) throw new AppError('STALE_ROUND');
}

function toAnswer(item: AnswerItem): ManadaAnswer {
  return { playerId: item.authorId, answer: item.answer };
}

async function roundAnswers(
  deps: Deps,
  state: ManadaPublic,
  nowMs: number,
): Promise<ManadaAnswer[]> {
  return (await deps.repos.matchSecrets.listAnswers(state.matchId, state.round, nowMs)).map(
    toAnswer,
  );
}

function manadaNextRound(
  deps: Deps,
  match: MatchItem,
  round: number,
  room: RoomItem,
): Promise<MatchUpdate> {
  const before = gameState(match, 'MANADA');
  requireOpen(before, ['REVEAL'], round);
  if (manadaGoalReached(before)) return Promise.resolve(settled(before, finishManada(before)));
  const picked = pickQuestion(deps, room);
  return Promise.resolve({
    publicState: openManadaRound(before, picked.question),
    usedManadaQuestionIds: picked.usedManadaQuestionIds,
  });
}

async function manadaDeparture(
  deps: Deps,
  match: MatchItem,
  playerId: string,
  _reason: DepartureReason,
  _room: RoomItem,
  nowMs: number,
): Promise<MatchUpdate | null> {
  const before = gameState(match, 'MANADA');
  const state = dropManadaPlayer(before, playerId);
  if (state === before) return null;
  if (state.status !== 'PLAYING' || state.phase !== 'ANSWER') return settled(before, state);

  const stored = await deps.repos.matchSecrets.listAnswers(match.matchId, state.round, nowMs);
  const discarded = stored
    .filter((item) => item.authorId === playerId)
    .map((item) => deps.repos.matchSecrets.deleteAnswerItem(item));
  const recorded = recordAnswers(
    state,
    stored.map((item) => item.authorId),
  );
  const publicState = allAnswersIn(recorded)
    ? revealManada(recorded, stored.map(toAnswer))
    : recorded;
  return { publicState, writes: discarded };
}

async function manadaSecret(
  deps: Deps,
  match: MatchItem,
  playerId: string,
  nowMs: number,
): Promise<MatchSecret | null> {
  const state = gameState(match, 'MANADA');
  if (state.status !== 'PLAYING' || state.phase !== 'ANSWER') return null;
  if (!isManadaPlayer(state, playerId)) return null;
  const own = await deps.repos.matchSecrets.getAnswer(match.matchId, state.round, playerId, nowMs);
  return { role: 'ANSWERER', round: state.round, answer: own?.answer ?? null };
}

export const manadaGame: GameModule<'MANADA'> = {
  defaultConfig: () => ({ ...MANADA_DEFAULTS }),
  parseConfig: parseManadaConfig,
  checkStart: checkManadaStart,
  prepare: prepareManada,
  nextRound: manadaNextRound,
  departure: manadaDeparture,
  secret: manadaSecret,
};

export async function commitAnswer(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, answer }: ManadaAnswerRequest,
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
  const problem = manadaAnswerProblem(gameState(match, 'MANADA'), player.playerId, round);
  if (problem) throw new AppError(problem);
  const stored = await deps.repos.matchSecrets.putAnswer({
    matchId,
    round,
    authorId: player.playerId,
    answer: cleanAnswer(answer),
    createdAt: iso(nowMs),
    ttl: ttlFrom(nowMs),
  });

  return updateRoom(deps, roomCode, async (state, now) => {
    const change = callerChange(state, player.playerId, now, 'member');
    const current = await requireCurrentMatch(deps, state, matchId, now);
    const before = gameState(current, 'MANADA');
    const counted = before.round === round && before.answeredPlayerIds.includes(player.playerId);
    if (!stored && counted) throw new AppError('ANSWER_CONFIRMED');
    if (!isManadaOpen(before, ['ANSWER'], round)) {
      if (counted) return change;
      throw new AppError('STALE_ROUND');
    }
    const answers = await roundAnswers(deps, before, now);
    const recorded = recordAnswers(
      before,
      answers.map((item) => item.playerId),
    );
    const publicState = allAnswersIn(recorded) ? revealManada(recorded, answers) : recorded;
    return applyMatchUpdate(change, current, { publicState }, now);
  });
}

export function closeAnswersCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', async (match, nowMs) => {
    const before = gameState(match, 'MANADA');
    requireOpen(before, ['ANSWER'], round);
    return { publicState: revealManada(before, await roundAnswers(deps, before, nowMs)) };
  });
}

export function mergeGroupsCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, groupIds }: MergeGroupsRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', (match) => {
    const before = gameState(match, 'MANADA');
    const problem = regroupProblem(before, round, groupIds);
    if (problem) throw new AppError(problem);
    return Promise.resolve({ publicState: mergeGroups(before, ...groupIds) });
  });
}

export function splitGroupCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, groupId }: SplitGroupRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', (match) => {
    const before = gameState(match, 'MANADA');
    const problem = regroupProblem(before, round, [groupId]);
    if (problem) throw new AppError(problem);
    return Promise.resolve({ publicState: splitGroup(before, groupId) });
  });
}
