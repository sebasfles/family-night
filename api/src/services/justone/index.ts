import {
  acceptGuess,
  acceptGuessProblem,
  allCluesIn,
  cancelClueProblem,
  dropJustOnePlayer,
  finishJustOne,
  isClueGiver,
  isJustOneOpen,
  justOneClueProblem,
  justOneGuessProblem,
  justOneScores,
  justOneStartProblem,
  nextJustOneTurn,
  openJustOneRound,
  openReview,
  pickJustOneWord,
  recordClues,
  revealJustOne,
  reviewedClues,
  setClueCancelled,
  showClues,
  showCluesProblem,
  startJustOne,
  JUST_ONE_DEFAULTS,
  type CancelClueRequest,
  type JustOneClue,
  type JustOneClueRequest,
  type JustOneConfig,
  type JustOneGuessRequest,
  type JustOnePublic,
  type JustOneSkippedTurn,
  type MatchSecret,
  type RoomSnapshot,
  type RoundRequest,
} from '@family-night/shared';
import { justOneConfigSchema } from '@family-night/shared/schemas';
import type { Deps } from '../../deps.ts';
import { AppError } from '../../lib/errors.ts';
import { iso, ttlFrom } from '../../lib/time.ts';
import type { ClueItem } from '../../repos/match-secrets.ts';
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
import { justOneWords } from './words.ts';

type Phase = JustOnePublic['phase'];

function parseJustOneConfig(raw: unknown): JustOneConfig {
  const parsed = justOneConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      'INVALID_CONFIG',
      parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return parsed.data;
}

function checkJustOneStart(_config: JustOneConfig, playerCount: number): void {
  const problem = justOneStartProblem(playerCount);
  if (problem) throw new AppError(problem);
}

function opening(deps: Deps, room: RoomItem, opened: JustOnePublic, nowMs: number): MatchUpdate {
  const picked = pickJustOneWord(justOneWords, room.usedJustOneWordIds, deps.secureRandomInt);
  return {
    publicState: opened,
    usedJustOneWordIds: picked.usedJustOneWordIds,
    writes: [
      deps.repos.matchSecrets.putRoundItem({
        matchId: opened.matchId,
        round: opened.round,
        guesserId: opened.guesserId,
        wordId: picked.word.id,
        word: picked.word.word,
        ttl: ttlFrom(nowMs),
      }),
    ],
  };
}

function prepareJustOne(deps: Deps, input: PrepareInput<JustOneConfig>): MatchUpdate {
  const { matchId, config, participants, room, nowMs } = input;
  const state = startJustOne({ matchId, config, participants, randomInt: deps.secureRandomInt });
  return opening(deps, room, state, nowMs);
}

function finished(before: JustOnePublic, after: JustOnePublic): MatchUpdate {
  const ended = before.status === 'PLAYING' && after.status === 'FINISHED';
  return { publicState: after, ...(ended ? { scores: justOneScores(after) } : {}) };
}

function advance(
  deps: Deps,
  room: RoomItem,
  before: JustOnePublic,
  state: JustOnePublic,
  skipped: JustOneSkippedTurn | null,
  nowMs: number,
): MatchUpdate {
  const turn = nextJustOneTurn(state);
  if (turn === null) return finished(before, finishJustOne(state));
  return opening(deps, room, openJustOneRound(state, turn, skipped), nowMs);
}

async function roundWord(deps: Deps, state: JustOnePublic, nowMs: number): Promise<string> {
  const secret = await deps.repos.matchSecrets.getJustOneRound(state.matchId, state.round, nowMs);
  if (!secret) {
    throw new Error(`match ${state.matchId} has no word for round ${String(state.round)}`);
  }
  return secret.word;
}

function toClue(item: ClueItem): JustOneClue {
  return { authorId: item.authorId, clue: item.clue };
}

async function roundClues(deps: Deps, state: JustOnePublic, nowMs: number): Promise<JustOneClue[]> {
  return (await deps.repos.matchSecrets.listClues(state.matchId, state.round, nowMs)).map(toClue);
}

async function review(deps: Deps, state: JustOnePublic, nowMs: number): Promise<JustOnePublic> {
  const [clues, word] = await Promise.all([
    roundClues(deps, state, nowMs),
    roundWord(deps, state, nowMs),
  ]);
  return openReview(state, clues, word);
}

function requireOpen(state: JustOnePublic, phases: readonly Phase[], round: number): void {
  if (!isJustOneOpen(state, phases, round)) throw new AppError('STALE_ROUND');
}

async function justOneNextRound(
  deps: Deps,
  match: MatchItem,
  round: number,
  room: RoomItem,
  nowMs: number,
): Promise<MatchUpdate> {
  const before = gameState(match, 'JUST_ONE');
  requireOpen(before, ['REVEAL'], round);
  return Promise.resolve(advance(deps, room, before, before, null, nowMs));
}

async function justOneDeparture(
  deps: Deps,
  match: MatchItem,
  playerId: string,
  reason: DepartureReason,
  room: RoomItem,
  nowMs: number,
): Promise<MatchUpdate | null> {
  const before = gameState(match, 'JUST_ONE');
  const { state, cancelsRound } = dropJustOnePlayer(before, playerId);
  if (state === before) return null;
  if (state.status === 'FINISHED') return finished(before, state);
  if (cancelsRound) {
    const skipped = { round: before.round, guesserId: playerId, reason };
    return advance(deps, room, before, state, skipped, nowMs);
  }
  if (state.phase !== 'CLUE' && state.phase !== 'REVIEW') return { publicState: state };

  const stored = await deps.repos.matchSecrets.listClues(match.matchId, state.round, nowMs);
  const discarded = stored
    .filter((item) => item.authorId === playerId)
    .map((item) => deps.repos.matchSecrets.deleteClueItem(item));
  if (state.phase === 'REVIEW') return { publicState: state, writes: discarded };
  const recorded = recordClues(
    state,
    stored.map((item) => item.authorId),
  );
  const publicState = allCluesIn(recorded) ? await review(deps, recorded, nowMs) : recorded;
  return { publicState, writes: discarded };
}

async function justOneSecret(
  deps: Deps,
  match: MatchItem,
  playerId: string,
  nowMs: number,
): Promise<MatchSecret | null> {
  const state = gameState(match, 'JUST_ONE');
  const hidden = state.phase === 'CLUE' || state.phase === 'REVIEW' || state.phase === 'GUESS';
  if (state.status !== 'PLAYING' || !hidden || !isClueGiver(state, playerId)) return null;
  const secret = await deps.repos.matchSecrets.getJustOneRound(match.matchId, state.round, nowMs);
  if (!secret || secret.guesserId === playerId) return null;
  const clues = await roundClues(deps, state, nowMs);
  return {
    role: 'CLUE_GIVER',
    round: secret.round,
    word: secret.word,
    clue: clues.find((clue) => clue.authorId === playerId)?.clue ?? null,
    clues: state.phase === 'CLUE' ? [] : reviewedClues(state, clues),
  };
}

export const justOneGame: GameModule<'JUST_ONE'> = {
  defaultConfig: () => ({ ...JUST_ONE_DEFAULTS }),
  parseConfig: parseJustOneConfig,
  checkStart: checkJustOneStart,
  prepare: prepareJustOne,
  nextRound: justOneNextRound,
  departure: justOneDeparture,
  secret: justOneSecret,
};

export async function commitClue(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, clue }: JustOneClueRequest,
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
  const problem = justOneClueProblem(gameState(match, 'JUST_ONE'), player.playerId, round);
  if (problem) throw new AppError(problem);
  const stored = await deps.repos.matchSecrets.putClue({
    matchId,
    round,
    authorId: player.playerId,
    clue,
    createdAt: iso(nowMs),
    ttl: ttlFrom(nowMs),
  });

  return updateRoom(deps, roomCode, async (state, now) => {
    const change = callerChange(state, player.playerId, now, 'member');
    const current = await requireCurrentMatch(deps, state, matchId, now);
    const before = gameState(current, 'JUST_ONE');
    const counted = before.round === round && before.committedPlayerIds.includes(player.playerId);
    if (!stored && counted) throw new AppError('STALE_ROUND');
    if (!isJustOneOpen(before, ['CLUE'], round)) {
      if (counted) return change;
      throw new AppError('STALE_ROUND');
    }
    const clues = await roundClues(deps, before, now);
    const recorded = recordClues(
      before,
      clues.map((item) => item.authorId),
    );
    const publicState = allCluesIn(recorded) ? await review(deps, recorded, now) : recorded;
    return applyMatchUpdate(change, current, { publicState }, now);
  });
}

export function closeCluesCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', async (match, nowMs) => {
    const before = gameState(match, 'JUST_ONE');
    requireOpen(before, ['CLUE'], round);
    return { publicState: await review(deps, before, nowMs) };
  });
}

export function cancelClueCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, authorId, cancelled }: CancelClueRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'member', (match) => {
    const state = gameState(match, 'JUST_ONE');
    const problem = cancelClueProblem(state, player.playerId, round, authorId);
    if (problem) throw new AppError(problem);
    return Promise.resolve({ publicState: setClueCancelled(state, authorId, cancelled) });
  });
}

export function showCluesCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return updateRoom(deps, roomCode, async (state, nowMs) => {
    const change = callerChange(state, player.playerId, nowMs, 'member');
    const match = await requireCurrentMatch(deps, state, matchId, nowMs);
    const before = gameState(match, 'JUST_ONE');
    const problem = showCluesProblem(before, player.playerId, change.hostId, round);
    if (problem) throw new AppError(problem);
    const publicState = showClues(before, await roundClues(deps, before, nowMs));
    return applyMatchUpdate(change, match, { publicState }, nowMs);
  });
}

export function guessCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, guess }: JustOneGuessRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'member', async (match, nowMs) => {
    const before = gameState(match, 'JUST_ONE');
    const problem = justOneGuessProblem(before, player.playerId, round);
    if (problem) throw new AppError(problem);
    const [clues, word] = await Promise.all([
      roundClues(deps, before, nowMs),
      roundWord(deps, before, nowMs),
    ]);
    return { publicState: revealJustOne(before, { word, guess, clues }) };
  });
}

export function acceptGuessCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', (match) => {
    const before = gameState(match, 'JUST_ONE');
    const problem = acceptGuessProblem(before, round);
    if (problem) throw new AppError(problem);
    return Promise.resolve({ publicState: acceptGuess(before) });
  });
}

export function skipGuesserCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', (match, nowMs, state) => {
    const before = gameState(match, 'JUST_ONE');
    requireOpen(before, ['CLUE', 'REVIEW', 'GUESS'], round);
    const skipped: JustOneSkippedTurn = { round, guesserId: before.guesserId, reason: 'SKIPPED' };
    return Promise.resolve(advance(deps, state.room, before, before, skipped, nowMs));
  });
}
