import type { GameConfigs, GameType, MatchSecret } from '@family-night/shared';
import type { Deps } from '../deps.ts';
import type { MatchItem } from '../repos/matches.ts';
import type { RoomItem } from '../repos/rooms.ts';
import { impostorGame } from './impostor/index.ts';
import type { MatchUpdate } from './matches/match-change.ts';
import { wavelengthGame } from './wavelength/index.ts';

export type DepartureReason = 'LEFT' | 'KICKED';

export interface PrepareInput<C> {
  matchId: string;
  config: C;
  participants: string[];
  room: RoomItem;
  nowMs: number;
}

export interface GameModule<G extends GameType = GameType> {
  defaultConfig(): GameConfigs[G];
  parseConfig(raw: unknown): GameConfigs[G];
  checkStart(config: GameConfigs[G], playerCount: number): void;
  prepare(deps: Deps, input: PrepareInput<GameConfigs[G]>): MatchUpdate;
  nextRound(
    deps: Deps,
    match: MatchItem,
    round: number,
    room: RoomItem,
    nowMs: number,
  ): Promise<MatchUpdate>;
  departure(
    deps: Deps,
    match: MatchItem,
    playerId: string,
    reason: DepartureReason,
    room: RoomItem,
    nowMs: number,
  ): Promise<MatchUpdate | null>;
  secret(
    deps: Deps,
    match: MatchItem,
    playerId: string,
    nowMs: number,
  ): Promise<MatchSecret | null>;
}

type Registry = { [G in GameType]: GameModule<G> };

function registry(): Registry {
  return { IMPOSTOR: impostorGame, WAVELENGTH: wavelengthGame };
}

export function gameOf(gameType: GameType): GameModule {
  return registry()[gameType];
}

export function resolveConfigs(stored: Partial<GameConfigs>): GameConfigs {
  const games = registry();
  return {
    IMPOSTOR: stored.IMPOSTOR ?? games.IMPOSTOR.defaultConfig(),
    WAVELENGTH: stored.WAVELENGTH ?? games.WAVELENGTH.defaultConfig(),
  };
}
