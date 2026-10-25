import {
  allCommitted,
  dialPoints,
  drawTarget,
  finishWavelength,
  guessersOf,
  normalizePlayerName,
  openRound,
  pickSpectrum,
  playerNameKey,
  recordCommits,
  revealRound,
  startWavelength,
  DIAL_MAX,
  MIN_WAVELENGTH_PLAYERS,
  ONE_DEVICE_MAX_PLAYERS,
  WAVELENGTH_DEFAULTS,
  type CommittedGuess,
  type Player,
  type RandomInt,
  type Spectrum,
  type WavelengthPublic,
} from '@family-night/shared';

export interface OneDeviceMatch {
  players: Player[];
  match: WavelengthPublic;
  target: number;
  guesses: CommittedGuess[];
}

export interface Draw {
  spectra: readonly Spectrum[];
  usedSpectrumIds: readonly string[];
  randomInt: RandomInt;
  matchId: string;
}

export interface Drawn {
  state: OneDeviceMatch;
  usedSpectrumIds: string[];
}

export function startOneDevice(names: readonly string[], draw: Draw): Drawn {
  const players = names.map((name, seat) => ({ playerId: `seat-${String(seat + 1)}`, name }));
  const picked = pickSpectrum(draw.spectra, draw.usedSpectrumIds, draw.randomInt);
  const match = startWavelength({
    matchId: draw.matchId,
    config: { ...WAVELENGTH_DEFAULTS },
    participants: players.map((player) => player.playerId),
    spectrum: picked.spectrum,
    randomInt: draw.randomInt,
  });
  return {
    state: { players, match, target: drawTarget(draw.randomInt), guesses: [] },
    usedSpectrumIds: picked.usedSpectrumIds,
  };
}

export function passOrder(state: OneDeviceMatch): string[] {
  const { participants, psychicId } = state.match;
  const seat = participants.indexOf(psychicId);
  return [...participants.slice(seat + 1), ...participants.slice(0, seat)];
}

export function nextGuesser(state: OneDeviceMatch): string | null {
  const done = state.match.committedPlayerIds;
  return passOrder(state).find((playerId) => !done.includes(playerId)) ?? null;
}

export function clueGiven(state: OneDeviceMatch): OneDeviceMatch {
  return { ...state, match: { ...state.match, phase: 'GUESS' } };
}

export function confirmGuess(state: OneDeviceMatch, value: number): OneDeviceMatch {
  const playerId = nextGuesser(state);
  if (!playerId) return state;
  const guesses = [...state.guesses, { playerId, value }];
  return { ...state, guesses, match: recordCommits(state.match, guesses) };
}

export function revealOneDevice(state: OneDeviceMatch): OneDeviceMatch {
  return { ...state, match: revealRound(state.match, state.target, state.guesses) };
}

export function nextOneDeviceRound(state: OneDeviceMatch, draw: Omit<Draw, 'matchId'>): Drawn {
  const picked = pickSpectrum(draw.spectra, draw.usedSpectrumIds, draw.randomInt);
  return {
    state: {
      ...state,
      match: openRound(state.match, state.match.turn + 1, picked.spectrum),
      target: drawTarget(draw.randomInt),
      guesses: [],
    },
    usedSpectrumIds: picked.usedSpectrumIds,
  };
}

export function finishOneDevice(state: OneDeviceMatch): OneDeviceMatch {
  return { ...state, match: finishWavelength(state.match), guesses: [] };
}

export function roundsPlayed(match: WavelengthPublic): number {
  return match.lastResult?.round ?? match.round - 1;
}

const MATCH_KEY = 'family-night.one-device.wavelength';
const SPECTRA_KEY = 'family-night.one-device.wavelength.spectra';
const VERSION = 1;

type Fields = Record<string, unknown>;

function isObject(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isDialValue(value: unknown): value is number {
  return isInt(value, 0, DIAL_MAX);
}

function sameItems(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item) => b.includes(item));
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validPlayers(value: unknown): value is Player[] {
  if (!Array.isArray(value)) return false;
  if (value.length < MIN_WAVELENGTH_PLAYERS || value.length > ONE_DEVICE_MAX_PLAYERS) return false;
  const keys = new Set<string>();
  return value.every((player: unknown, seat) => {
    if (!isObject(player) || player.playerId !== `seat-${String(seat + 1)}`) return false;
    if (typeof player.name !== 'string' || normalizePlayerName(player.name) !== player.name) {
      return false;
    }
    const key = playerNameKey(player.name);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function validSpectrum(value: unknown): value is Spectrum {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.left === 'string' &&
    typeof value.right === 'string'
  );
}

function validTotals(value: unknown, ids: readonly string[]): boolean {
  return (
    isObject(value) && sameItems(Object.keys(value), ids) && ids.every((id) => isInt(value[id], 0))
  );
}

function validResult(match: WavelengthPublic, target: number, guessers: string[]): boolean {
  const result: unknown = match.lastResult;
  if (match.phase !== 'REVEAL') return result === null;
  if (!isObject(result) || !Array.isArray(result.guesses)) return false;
  const guesses: unknown[] = result.guesses;
  const fair = guesses.every(
    (guess) =>
      isObject(guess) &&
      typeof guess.playerId === 'string' &&
      (guess.value === null
        ? guess.points === 0
        : isDialValue(guess.value) && guess.points === dialPoints(guess.value, target)),
  );
  return (
    fair &&
    result.round === match.round &&
    result.psychicId === match.psychicId &&
    result.target === target &&
    isInt(result.psychicPoints, 0) &&
    sameItems(
      guesses.map((guess) => (guess as Fields).playerId as string),
      guessers,
    )
  );
}

function validMatch(value: unknown, ids: readonly string[]): value is WavelengthPublic {
  if (!isObject(value) || value.gameType !== 'WAVELENGTH' || value.status !== 'PLAYING') {
    return false;
  }
  const { phase, order, participants, turn } = value;
  if (phase !== 'CLUE' && phase !== 'GUESS' && phase !== 'REVEAL') return false;
  if (!isStringList(participants) || participants.join() !== ids.join()) return false;
  if (!isStringList(order) || !sameItems(order, ids) || !isInt(turn, 0)) return false;
  return (
    typeof value.matchId === 'string' &&
    isObject(value.config) &&
    isInt(value.round, 1) &&
    isStringList(value.departedIds) &&
    value.departedIds.length === 0 &&
    value.psychicId === order[turn % order.length] &&
    validSpectrum(value.spectrum) &&
    value.clue === null &&
    value.skipped === null &&
    isStringList(value.committedPlayerIds) &&
    validTotals(value.totals, ids)
  );
}

function parseOneDeviceMatch(raw: unknown): OneDeviceMatch | null {
  if (!isObject(raw) || raw.version !== VERSION) return null;
  const { players, match, target, guesses } = raw;
  if (!validPlayers(players) || !isDialValue(target)) return null;
  const ids = players.map((player) => player.playerId);
  if (!validMatch(match, ids)) return null;
  const guessers = guessersOf(match);
  if (!Array.isArray(guesses)) return null;
  const valid = guesses.every(
    (guess: unknown) =>
      isObject(guess) &&
      typeof guess.playerId === 'string' &&
      guessers.includes(guess.playerId) &&
      isDialValue(guess.value),
  );
  if (!valid) return null;
  const state: OneDeviceMatch = { players, match, target, guesses: guesses as CommittedGuess[] };
  const committed = state.guesses.map((guess) => guess.playerId);
  if (new Set(committed).size !== committed.length) return null;
  if (!sameItems(match.committedPlayerIds, committed)) return null;
  if (match.phase === 'CLUE' && committed.length > 0) return null;
  if (match.phase === 'REVEAL' && !allCommitted(match)) return null;
  const turnOrder = passOrder(state).slice(0, committed.length);
  if (!sameItems(turnOrder, committed)) return null;
  return validResult(match, target, guessers) ? state : null;
}

export function loadOneDeviceMatch(): OneDeviceMatch | null {
  try {
    const raw = localStorage.getItem(MATCH_KEY);
    if (raw === null) return null;
    const state = parseOneDeviceMatch(JSON.parse(raw));
    if (!state) localStorage.removeItem(MATCH_KEY);
    return state;
  } catch {
    return null;
  }
}

export function saveOneDeviceMatch(state: OneDeviceMatch): void {
  try {
    localStorage.setItem(MATCH_KEY, JSON.stringify({ version: VERSION, ...state }));
  } catch {
    return;
  }
}

export function clearOneDeviceMatch(): void {
  try {
    localStorage.removeItem(MATCH_KEY);
  } catch {
    return;
  }
}

export function loadUsedSpectra(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SPECTRA_KEY) ?? '[]');
    return isStringList(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUsedSpectra(ids: readonly string[]): void {
  try {
    localStorage.setItem(SPECTRA_KEY, JSON.stringify(ids));
  } catch {
    return;
  }
}
