import {
  IMPOSTOR_DEFAULTS,
  type CreatePlayerResponse,
  type ImpostorConfig,
  type ImpostorPublic,
  type ImpostorSecret,
  type MatchSecretResponse,
  type RoomResponse,
  type RoomSnapshot,
} from '@family-night/shared';
import { wordCategories } from '../services/impostor/words.ts';
import { call, json, roomWith } from './harness.ts';

export type Room = Awaited<ReturnType<typeof roomWith>>;

export function impostorConfig(overrides: Partial<ImpostorConfig> = {}): ImpostorConfig {
  return {
    ...IMPOSTOR_DEFAULTS,
    categories: wordCategories.map((category) => category.id),
    ...overrides,
  };
}

export function currentMatch(room: RoomSnapshot): ImpostorPublic {
  if (room.currentMatch?.gameType !== 'IMPOSTOR') throw new Error('no current Impostor match');
  return room.currentMatch;
}

export function matchPath(room: Room, matchId: string, action: string): string {
  return `/api/rooms/${room.code}/matches/${matchId}/${action}`;
}

export async function start(
  room: Room,
  overrides: Partial<ImpostorConfig> = {},
): Promise<RoomSnapshot> {
  const body = { gameType: 'IMPOSTOR', config: impostorConfig(overrides) };
  return (
    await json<RoomResponse>(
      call(room.harness, room.host, 'POST', `/api/rooms/${room.code}/matches`, body),
      201,
    )
  ).room;
}

export async function secretOf(
  room: Room,
  player: CreatePlayerResponse,
  matchId: string,
): Promise<ImpostorSecret | null> {
  const response = call(room.harness, player, 'GET', matchPath(room, matchId, 'me'));
  const { secret } = await json<MatchSecretResponse>(response);
  if (secret?.role === 'PSYCHIC') throw new Error('not an Impostor secret');
  return secret;
}

export interface Roles {
  impostors: CreatePlayerResponse[];
  civilians: CreatePlayerResponse[];
  word: string;
  clue: string;
}

export async function rolesOf(room: Room, match: ImpostorPublic): Promise<Roles> {
  const roles: Roles = { impostors: [], civilians: [], word: '', clue: '' };
  for (const playerId of match.participants) {
    const player = room.players.find((candidate) => candidate.playerId === playerId);
    if (!player) throw new Error(`participant ${playerId} is not a test player`);
    const secret = await secretOf(room, player, match.matchId);
    if (secret?.role === 'IMPOSTOR') {
      roles.impostors.push(player);
      roles.clue = secret.clue;
    } else if (secret?.role === 'CIVILIAN') {
      roles.civilians.push(player);
      roles.word = secret.word;
    }
  }
  return roles;
}

export function vote(
  room: Room,
  voter: CreatePlayerResponse,
  target: CreatePlayerResponse,
  match: ImpostorPublic,
  round = match.round,
): Promise<Response> {
  return call(room.harness, voter, 'PUT', matchPath(room, match.matchId, 'votes'), {
    round,
    targetId: target.playerId,
  });
}

export async function voted(
  room: Room,
  voter: CreatePlayerResponse,
  target: CreatePlayerResponse,
  match: ImpostorPublic,
): Promise<ImpostorPublic> {
  return currentMatch((await json<RoomResponse>(vote(room, voter, target, match))).room);
}

export async function hostAction(
  room: Room,
  match: { matchId: string },
  action: string,
  body?: unknown,
): Promise<RoomSnapshot> {
  const response = call(
    room.harness,
    room.host,
    'POST',
    matchPath(room, match.matchId, action),
    body,
  );
  return (await json<RoomResponse>(response)).room;
}

export async function everyoneVotes(
  room: Room,
  match: ImpostorPublic,
  target: CreatePlayerResponse,
  fallback: CreatePlayerResponse,
): Promise<ImpostorPublic> {
  let latest = match;
  for (const playerId of match.order) {
    const voter = room.players.find((candidate) => candidate.playerId === playerId);
    if (!voter) throw new Error(`voter ${playerId} is not a test player`);
    latest = await voted(room, voter, voter === target ? fallback : target, latest);
  }
  return latest;
}
