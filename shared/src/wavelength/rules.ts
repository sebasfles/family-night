import {
  DIAL_BANDS,
  DIAL_MAX,
  MIN_WAVELENGTH_ACTIVE,
  MIN_WAVELENGTH_PLAYERS,
} from '../constants.ts';
import type {
  DialGuess,
  SkippedTurn,
  Spectrum,
  WavelengthConfig,
  WavelengthPublic,
} from '../domain.ts';
import { shuffle, type RandomInt } from '../random.ts';

export interface CommittedGuess {
  playerId: string;
  value: number;
}

export function dialPoints(value: number, target: number): number {
  const distance = Math.abs(value - target);
  return DIAL_BANDS.find((band) => distance <= band.within)?.points ?? 0;
}

export function psychicPoints(points: readonly number[]): number {
  if (points.length === 0) return 0;
  const sum = points.reduce((total, value) => total + value, 0);
  return Math.floor((2 * sum + points.length) / (2 * points.length));
}

export function drawTarget(randomInt: RandomInt): number {
  return randomInt(DIAL_MAX + 1);
}

export function pickSpectrum<S extends Spectrum>(
  spectra: readonly S[],
  usedSpectrumIds: readonly string[],
  randomInt: RandomInt,
): { spectrum: S; usedSpectrumIds: string[] } {
  const used = new Set(usedSpectrumIds);
  const unseen = spectra.filter((spectrum) => !used.has(spectrum.id));
  const exhausted = unseen.length === 0;
  const pool = exhausted ? spectra : unseen;
  const spectrum = pool[randomInt(pool.length)];
  if (!spectrum) throw new Error('the spectra bank is empty');
  return {
    spectrum,
    usedSpectrumIds: [...(exhausted ? [] : usedSpectrumIds), spectrum.id],
  };
}

export function wavelengthStartProblem(playerCount: number): 'NOT_ENOUGH_PLAYERS' | null {
  return playerCount < MIN_WAVELENGTH_PLAYERS ? 'NOT_ENOUGH_PLAYERS' : null;
}

export function startWavelength(input: {
  matchId: string;
  config: WavelengthConfig;
  participants: readonly string[];
  spectrum: Spectrum;
  randomInt: RandomInt;
}): WavelengthPublic {
  const { matchId, config, participants, spectrum, randomInt } = input;
  const order = shuffle(participants, randomInt);
  const [psychicId] = order;
  if (!psychicId) throw new Error('a match needs participants');
  return {
    gameType: 'WAVELENGTH',
    matchId,
    status: 'PLAYING',
    phase: 'CLUE',
    config,
    round: 1,
    turn: 0,
    participants: [...participants],
    order,
    departedIds: [],
    psychicId,
    spectrum,
    clue: null,
    committedPlayerIds: [],
    skipped: null,
    lastResult: null,
    totals: Object.fromEntries(participants.map((id) => [id, 0])),
  };
}

export function isWavelengthPlayer(state: WavelengthPublic, playerId: string): boolean {
  return state.participants.includes(playerId) && !state.departedIds.includes(playerId);
}

export function wavelengthPlayers(state: WavelengthPublic): string[] {
  return state.participants.filter((id) => !state.departedIds.includes(id));
}

export function guessersOf(state: WavelengthPublic): string[] {
  return wavelengthPlayers(state).filter((id) => id !== state.psychicId);
}

export function totalTurns(state: WavelengthPublic): number {
  return state.config.cycles * state.order.length;
}

export function psychicOfTurn(state: WavelengthPublic, turn: number): string {
  const psychicId = state.order[turn % state.order.length];
  if (!psychicId) throw new Error('a match needs a psychic order');
  return psychicId;
}

export function nextTurn(state: WavelengthPublic): number | null {
  for (let turn = state.turn + 1; turn < totalTurns(state); turn++) {
    if (isWavelengthPlayer(state, psychicOfTurn(state, turn))) return turn;
  }
  return null;
}

export function openRound(
  state: WavelengthPublic,
  turn: number,
  spectrum: Spectrum,
  skipped: SkippedTurn | null = null,
): WavelengthPublic {
  return {
    ...state,
    phase: 'CLUE',
    round: state.round + 1,
    turn,
    psychicId: psychicOfTurn(state, turn),
    spectrum,
    clue: null,
    committedPlayerIds: [],
    skipped,
    lastResult: null,
  };
}

function isOpen(state: WavelengthPublic, phase: WavelengthPublic['phase'], round: number) {
  return state.status === 'PLAYING' && state.phase === phase && state.round === round;
}

export function clueProblem(
  state: WavelengthPublic,
  callerId: string,
  round: number,
): 'STALE_ROUND' | 'NOT_PSYCHIC' | null {
  if (!isOpen(state, 'CLUE', round)) return 'STALE_ROUND';
  return callerId === state.psychicId ? null : 'NOT_PSYCHIC';
}

export function giveClue(state: WavelengthPublic, clue: string): WavelengthPublic {
  return { ...state, phase: 'GUESS', clue, skipped: null };
}

export function dialGuessProblem(
  state: WavelengthPublic,
  callerId: string,
  round: number,
): 'STALE_ROUND' | 'INVALID_GUESS' | null {
  if (!isOpen(state, 'GUESS', round)) return 'STALE_ROUND';
  return guessersOf(state).includes(callerId) ? null : 'INVALID_GUESS';
}

export function recordCommits(
  state: WavelengthPublic,
  guesses: readonly CommittedGuess[],
): WavelengthPublic {
  const committed = new Set(guesses.map((guess) => guess.playerId));
  return { ...state, committedPlayerIds: guessersOf(state).filter((id) => committed.has(id)) };
}

export function allCommitted(state: WavelengthPublic): boolean {
  return guessersOf(state).every((id) => state.committedPlayerIds.includes(id));
}

export function revealRound(
  state: WavelengthPublic,
  target: number,
  guesses: readonly CommittedGuess[],
): WavelengthPublic {
  const dial: DialGuess[] = guessersOf(state).map((playerId) => {
    const guess = guesses.find((candidate) => candidate.playerId === playerId);
    return guess
      ? { playerId, value: guess.value, points: dialPoints(guess.value, target) }
      : { playerId, value: null, points: 0 };
  });
  const earned = psychicPoints(
    dial.filter((guess) => guess.value !== null).map((guess) => guess.points),
  );
  const totals = { ...state.totals };
  for (const guess of dial) totals[guess.playerId] = (totals[guess.playerId] ?? 0) + guess.points;
  totals[state.psychicId] = (totals[state.psychicId] ?? 0) + earned;
  return {
    ...recordCommits(state, guesses),
    phase: 'REVEAL',
    lastResult: {
      round: state.round,
      psychicId: state.psychicId,
      target,
      guesses: dial,
      psychicPoints: earned,
    },
    totals,
  };
}

export function finishWavelength(state: WavelengthPublic): WavelengthPublic {
  return { ...state, status: 'FINISHED', phase: 'FINISHED' };
}

export function dropWavelengthPlayer(
  state: WavelengthPublic,
  playerId: string,
): { state: WavelengthPublic; cancelsRound: boolean } {
  if (state.status !== 'PLAYING' || !isWavelengthPlayer(state, playerId)) {
    return { state, cancelsRound: false };
  }
  const dropped: WavelengthPublic = {
    ...state,
    departedIds: [...state.departedIds, playerId],
    committedPlayerIds: state.committedPlayerIds.filter((id) => id !== playerId),
  };
  if (wavelengthPlayers(dropped).length < MIN_WAVELENGTH_ACTIVE) {
    return { state: finishWavelength(dropped), cancelsRound: false };
  }
  const cancelsRound =
    playerId === state.psychicId && (state.phase === 'CLUE' || state.phase === 'GUESS');
  return { state: dropped, cancelsRound };
}

export function wavelengthScores(state: WavelengthPublic): Record<string, number> {
  return Object.fromEntries(
    wavelengthPlayers(state)
      .map((id) => [id, state.totals[id] ?? 0] as const)
      .filter(([, points]) => points > 0),
  );
}
