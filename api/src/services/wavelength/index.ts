import {
  allCommitted,
  clueProblem,
  dialGuessProblem,
  drawTarget,
  dropWavelengthPlayer,
  finishWavelength,
  giveClue,
  nextTurn,
  openRound,
  pickSpectrum,
  recordCommits,
  revealRound,
  startWavelength,
  wavelengthScores,
  wavelengthStartProblem,
  WAVELENGTH_DEFAULTS,
  type ClueRequest,
  type CommittedGuess,
  type DialGuessRequest,
  type MatchSecret,
  type RoomSnapshot,
  type RoundRequest,
  type SkippedTurn,
  type WavelengthConfig,
  type WavelengthPublic,
} from '@family-night/shared';
import { wavelengthConfigSchema } from '@family-night/shared/schemas';
import type { Deps } from '../../deps.ts';
import { AppError } from '../../lib/errors.ts';
import { iso, ttlFrom } from '../../lib/time.ts';
import type { DialGuessItem } from '../../repos/match-secrets.ts';
import type { MatchItem } from '../../repos/matches.ts';
import type { PlayerItem } from '../../repos/players.ts';
import type { RoomItem } from '../../repos/rooms.ts';
import type { GameModule, PrepareInput } from '../games.ts';
import {
  applyMatchUpdate,
  callerChange,
  gameState,
  matchCommand,
  requireCurrentMatch,
  type MatchUpdate,
} from '../matches/match-change.ts';
import { updateRoom } from '../room-state.ts';
import { spectraBank } from './spectra.ts';

function parseWavelengthConfig(raw: unknown): WavelengthConfig {
  const parsed = wavelengthConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      'INVALID_CONFIG',
      parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return parsed.data;
}

function checkWavelengthStart(_config: WavelengthConfig, playerCount: number): void {
  const problem = wavelengthStartProblem(playerCount);
  if (problem) throw new AppError(problem);
}

function roundSecret(deps: Deps, state: WavelengthPublic, nowMs: number) {
  return deps.repos.matchSecrets.putRoundItem({
    matchId: state.matchId,
    round: state.round,
    psychicId: state.psychicId,
    target: drawTarget(deps.secureRandomInt),
    ttl: ttlFrom(nowMs),
  });
}

function prepareWavelength(deps: Deps, input: PrepareInput<WavelengthConfig>): MatchUpdate {
  const { matchId, config, participants, room, nowMs } = input;
  const picked = pickSpectrum(spectraBank, room.usedSpectrumIds, deps.secureRandomInt);
  const state = startWavelength({
    matchId,
    config,
    participants,
    spectrum: picked.spectrum,
    randomInt: deps.secureRandomInt,
  });
  return {
    publicState: state,
    usedSpectrumIds: picked.usedSpectrumIds,
    writes: [roundSecret(deps, state, nowMs)],
  };
}

function finished(before: WavelengthPublic, after: WavelengthPublic): MatchUpdate {
  const ended = before.status === 'PLAYING' && after.status === 'FINISHED';
  return { publicState: after, ...(ended ? { scores: wavelengthScores(after) } : {}) };
}

function advance(
  deps: Deps,
  room: RoomItem,
  before: WavelengthPublic,
  state: WavelengthPublic,
  skipped: SkippedTurn | null,
  nowMs: number,
): MatchUpdate {
  const turn = nextTurn(state);
  if (turn === null) return finished(before, finishWavelength(state));
  const picked = pickSpectrum(spectraBank, room.usedSpectrumIds, deps.secureRandomInt);
  const opened = openRound(state, turn, picked.spectrum, skipped);
  return {
    publicState: opened,
    usedSpectrumIds: picked.usedSpectrumIds,
    writes: [roundSecret(deps, opened, nowMs)],
  };
}

function toGuess(item: DialGuessItem): CommittedGuess {
  return { playerId: item.guesserId, value: item.value };
}

async function roundGuesses(
  deps: Deps,
  state: WavelengthPublic,
  nowMs: number,
): Promise<CommittedGuess[]> {
  return (await deps.repos.matchSecrets.listGuesses(state.matchId, state.round, nowMs)).map(
    toGuess,
  );
}

async function reveal(
  deps: Deps,
  state: WavelengthPublic,
  guesses: CommittedGuess[],
  nowMs: number,
): Promise<WavelengthPublic> {
  const secret = await deps.repos.matchSecrets.getRound(state.matchId, state.round, nowMs);
  if (!secret) {
    throw new Error(`match ${state.matchId} has no target for round ${String(state.round)}`);
  }
  return revealRound(state, secret.target, guesses);
}

function requireOpen(state: WavelengthPublic, phase: WavelengthPublic['phase'], round: number) {
  if (state.status !== 'PLAYING' || state.phase !== phase || state.round !== round) {
    throw new AppError('STALE_ROUND');
  }
}

async function wavelengthNextRound(
  deps: Deps,
  match: MatchItem,
  round: number,
  room: RoomItem,
  nowMs: number,
): Promise<MatchUpdate> {
  const before = gameState(match, 'WAVELENGTH');
  requireOpen(before, 'REVEAL', round);
  return Promise.resolve(advance(deps, room, before, before, null, nowMs));
}

async function wavelengthDeparture(
  deps: Deps,
  match: MatchItem,
  playerId: string,
  reason: 'LEFT' | 'KICKED',
  room: RoomItem,
  nowMs: number,
): Promise<MatchUpdate | null> {
  const before = gameState(match, 'WAVELENGTH');
  const { state, cancelsRound } = dropWavelengthPlayer(before, playerId);
  if (state === before) return null;
  if (state.status === 'FINISHED') return finished(before, state);
  if (cancelsRound) {
    const skipped = { round: before.round, psychicId: playerId, reason };
    return advance(deps, room, before, state, skipped, nowMs);
  }
  if (state.phase !== 'GUESS') return { publicState: state };

  const stored = await deps.repos.matchSecrets.listGuesses(match.matchId, state.round, nowMs);
  const discarded = stored
    .filter((item) => item.guesserId === playerId)
    .map((item) => deps.repos.matchSecrets.deleteGuessItem(item));
  const guesses = stored.filter((item) => item.guesserId !== playerId).map(toGuess);
  const recorded = recordCommits(state, guesses);
  const publicState = allCommitted(recorded)
    ? await reveal(deps, recorded, guesses, nowMs)
    : recorded;
  return { publicState, writes: discarded };
}

async function wavelengthSecret(
  deps: Deps,
  match: MatchItem,
  playerId: string,
  nowMs: number,
): Promise<MatchSecret | null> {
  const state = gameState(match, 'WAVELENGTH');
  const hidden = state.phase === 'CLUE' || state.phase === 'GUESS';
  if (state.status !== 'PLAYING' || !hidden || state.psychicId !== playerId) return null;
  const secret = await deps.repos.matchSecrets.getRound(match.matchId, state.round, nowMs);
  if (secret?.psychicId !== playerId) return null;
  return { role: 'PSYCHIC', round: secret.round, target: secret.target };
}

export const wavelengthGame: GameModule<'WAVELENGTH'> = {
  defaultConfig: () => ({ ...WAVELENGTH_DEFAULTS }),
  parseConfig: parseWavelengthConfig,
  checkStart: checkWavelengthStart,
  prepare: prepareWavelength,
  nextRound: wavelengthNextRound,
  departure: wavelengthDeparture,
  secret: wavelengthSecret,
};

export function clueCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, clue }: ClueRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'member', (match) => {
    const state = gameState(match, 'WAVELENGTH');
    const problem = clueProblem(state, player.playerId, round);
    if (problem) throw new AppError(problem);
    return Promise.resolve({ publicState: giveClue(state, clue) });
  });
}

export async function commitGuess(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round, value }: DialGuessRequest,
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
  const problem = dialGuessProblem(gameState(match, 'WAVELENGTH'), player.playerId, round);
  if (problem) throw new AppError(problem);
  const stored = await deps.repos.matchSecrets.putGuess({
    matchId,
    round,
    guesserId: player.playerId,
    value,
    createdAt: iso(nowMs),
    ttl: ttlFrom(nowMs),
  });

  return updateRoom(deps, roomCode, async (state, now) => {
    const change = callerChange(state, player.playerId, now, 'member');
    const current = await requireCurrentMatch(deps, state, matchId, now);
    const before = gameState(current, 'WAVELENGTH');
    const counted = before.round === round && before.committedPlayerIds.includes(player.playerId);
    if (!stored && counted) throw new AppError('STALE_ROUND');
    if (before.status !== 'PLAYING' || before.phase !== 'GUESS' || before.round !== round) {
      if (counted) return change;
      throw new AppError('STALE_ROUND');
    }
    const guesses = await roundGuesses(deps, before, now);
    const recorded = recordCommits(before, guesses);
    const publicState = allCommitted(recorded)
      ? await reveal(deps, recorded, guesses, now)
      : recorded;
    return applyMatchUpdate(change, current, { publicState }, now);
  });
}

export function closeGuessingCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', async (match, nowMs) => {
    const before = gameState(match, 'WAVELENGTH');
    requireOpen(before, 'GUESS', round);
    const guesses = await roundGuesses(deps, before, nowMs);
    return { publicState: await reveal(deps, recordCommits(before, guesses), guesses, nowMs) };
  });
}

export function skipPsychicCommand(
  deps: Deps,
  player: PlayerItem,
  roomCode: string,
  matchId: string,
  { round }: RoundRequest,
): Promise<RoomSnapshot> {
  return matchCommand(deps, player, roomCode, matchId, 'host', (match, nowMs, state) => {
    const before = gameState(match, 'WAVELENGTH');
    requireOpen(before, 'CLUE', round);
    const skipped: SkippedTurn = { round, psychicId: before.psychicId, reason: 'SKIPPED' };
    return Promise.resolve(advance(deps, state.room, before, before, skipped, nowMs));
  });
}
