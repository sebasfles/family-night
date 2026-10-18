export interface Player {
  playerId: string;
  name: string;
}

export interface RoomMember {
  playerId: string;
  name: string;
  online: boolean;
  lastSeenAt: string;
  totalScore: number;
  joinedAt: string;
}

export type GameType = 'IMPOSTOR' | 'WAVELENGTH';

export type TieRule = 'SKIP' | 'RANDOM';

export interface ImpostorConfig {
  impostorCount: number;
  randomOrder: boolean;
  tieRule: TieRule;
  showCategoryToImpostor: boolean;
  categories: string[];
  impostorLastGuess: boolean;
}

export interface WavelengthConfig {
  cycles: number;
}

export interface GameConfigs {
  IMPOSTOR: ImpostorConfig;
  WAVELENGTH: WavelengthConfig;
}

export type MatchStatus = 'PLAYING' | 'FINISHED' | 'ABORTED';

export type ImpostorPhase = 'VOTING' | 'REVEAL' | 'IMPOSTOR_GUESS' | 'FINISHED';

export type EliminationReason = 'VOTE' | 'TIE_RANDOM' | 'LEFT' | 'KICKED';

export type ImpostorWinner = 'CIVILIANS' | 'IMPOSTORS';

export interface Elimination {
  playerId: string;
  round: number;
  wasImpostor: boolean;
  reason: EliminationReason;
}

export interface TallyEntry {
  playerId: string;
  votes: number;
}

export interface RoundResult {
  round: number;
  tally: TallyEntry[];
  tie: boolean;
  eliminatedId: string | null;
}

export interface ImpostorGuess {
  guesserId: string;
  options: string[];
  chosen: string | null;
  correct: boolean | null;
}

export interface ImpostorReveal {
  word: string;
  category: string;
  impostorIds: string[];
}

export interface ImpostorPublic {
  gameType: 'IMPOSTOR';
  matchId: string;
  status: MatchStatus;
  phase: ImpostorPhase;
  config: ImpostorConfig;
  round: number;
  participants: string[];
  order: string[];
  eliminated: Elimination[];
  votedPlayerIds: string[];
  lastResult: RoundResult | null;
  guess: ImpostorGuess | null;
  winner: ImpostorWinner | null;
  reveal: ImpostorReveal | null;
}

export type WavelengthPhase = 'CLUE' | 'GUESS' | 'REVEAL' | 'FINISHED';

export interface Spectrum {
  id: string;
  left: string;
  right: string;
}

export interface DialGuess {
  playerId: string;
  value: number | null;
  points: number;
}

export interface WavelengthResult {
  round: number;
  psychicId: string;
  target: number;
  guesses: DialGuess[];
  psychicPoints: number;
}

export type SkipReason = 'LEFT' | 'KICKED' | 'SKIPPED';

export interface SkippedTurn {
  round: number;
  psychicId: string;
  reason: SkipReason;
}

export interface WavelengthPublic {
  gameType: 'WAVELENGTH';
  matchId: string;
  status: MatchStatus;
  phase: WavelengthPhase;
  config: WavelengthConfig;
  round: number;
  turn: number;
  participants: string[];
  order: string[];
  departedIds: string[];
  psychicId: string;
  spectrum: Spectrum;
  clue: string | null;
  committedPlayerIds: string[];
  skipped: SkippedTurn | null;
  lastResult: WavelengthResult | null;
  totals: Record<string, number>;
}

export type MatchPublic = ImpostorPublic | WavelengthPublic;

export type ImpostorSecret =
  | { role: 'CIVILIAN'; word: string; category: string }
  | { role: 'IMPOSTOR'; clue: string; category: string | null };

export interface WavelengthSecret {
  role: 'PSYCHIC';
  round: number;
  target: number;
}

export type MatchSecret = ImpostorSecret | WavelengthSecret;

export interface RoomSnapshot {
  roomCode: string;
  version: number;
  hostId: string;
  members: RoomMember[];
  currentMatch: MatchPublic | null;
  selectedGame: GameType;
  configs: GameConfigs;
  serverTime: string;
}
