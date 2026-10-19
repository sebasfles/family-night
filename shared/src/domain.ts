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

export type GameType = 'IMPOSTOR' | 'WAVELENGTH' | 'JUST_ONE';

export type TieRule = 'SKIP' | 'RANDOM';

export interface ImpostorConfig {
  impostorCount: number;
  randomOrder: boolean;
  tieRule: TieRule;
  showCategoryToImpostor: boolean;
  categories: string[];
}

export interface WavelengthConfig {
  cycles: number;
}

export interface JustOneConfig {
  cycles: number;
}

export interface GameConfigs {
  IMPOSTOR: ImpostorConfig;
  WAVELENGTH: WavelengthConfig;
  JUST_ONE: JustOneConfig;
}

export type MatchStatus = 'PLAYING' | 'FINISHED' | 'ABORTED';

export type ImpostorPhase = 'VOTING' | 'REVEAL' | 'FINISHED';

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
  departedIds: string[];
  votedPlayerIds: string[];
  lastResult: RoundResult | null;
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

export type JustOnePhase = 'CLUE' | 'REVIEW' | 'GUESS' | 'REVEAL' | 'FINISHED';

export type JustOneOutcome = 'CORRECT' | 'WRONG' | 'PASS';

export interface JustOneClue {
  authorId: string;
  clue: string;
}

export interface JustOneRevealedClue extends JustOneClue {
  cancelled: boolean;
}

export interface JustOneSkippedTurn {
  round: number;
  guesserId: string;
  reason: SkipReason;
}

export interface JustOneResult {
  round: number;
  guesserId: string;
  word: string;
  guess: string | null;
  outcome: JustOneOutcome;
  accepted: boolean;
  clues: JustOneRevealedClue[];
  scoreBefore: number;
  score: number;
}

export interface JustOnePublic {
  gameType: 'JUST_ONE';
  matchId: string;
  status: MatchStatus;
  phase: JustOnePhase;
  config: JustOneConfig;
  round: number;
  turn: number;
  participants: string[];
  order: string[];
  departedIds: string[];
  guesserId: string;
  committedPlayerIds: string[];
  cancelledAuthorIds: string[];
  clues: JustOneClue[] | null;
  skipped: JustOneSkippedTurn | null;
  lastResult: JustOneResult | null;
  score: number;
  roundsWon: number;
}

export type MatchPublic = ImpostorPublic | WavelengthPublic | JustOnePublic;

export type ImpostorSecret =
  | { role: 'CIVILIAN'; word: string; category: string }
  | { role: 'IMPOSTOR'; clue: string; category: string | null };

export interface WavelengthSecret {
  role: 'PSYCHIC';
  round: number;
  target: number;
}

export interface JustOneSecret {
  role: 'CLUE_GIVER';
  round: number;
  word: string;
  clue: string | null;
  clues: JustOneClue[];
}

export type MatchSecret = ImpostorSecret | WavelengthSecret | JustOneSecret;

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
