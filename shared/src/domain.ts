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

export type GameType = 'IMPOSTOR';

export type TieRule = 'SKIP' | 'RANDOM';

export interface ImpostorConfig {
  impostorCount: number;
  randomOrder: boolean;
  tieRule: TieRule;
  showCategoryToImpostor: boolean;
  categories: string[];
  impostorLastGuess: boolean;
}

export interface GameConfigs {
  IMPOSTOR: ImpostorConfig;
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

export type MatchPublic = ImpostorPublic;

export type ImpostorSecret =
  | { role: 'CIVILIAN'; word: string; category: string }
  | { role: 'IMPOSTOR'; clue: string; category: string | null };

export interface RoomSnapshot {
  roomCode: string;
  version: number;
  hostId: string;
  members: RoomMember[];
  currentMatch: MatchPublic | null;
  configs: GameConfigs;
  serverTime: string;
}
