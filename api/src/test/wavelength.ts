import {
  type CreatePlayerResponse,
  type MatchSecretResponse,
  type RandomInt,
  type RoomResponse,
  type RoomSnapshot,
  type WavelengthPublic,
  type WavelengthSecret,
} from '@family-night/shared';
import { cryptoRandomInt } from '../deps.ts';
import { call, json } from './harness.ts';
import { matchPath, type Room } from './impostor.ts';

export function fixedTarget(target: number): RandomInt {
  return (max) => (max === 101 ? target : cryptoRandomInt(max));
}

export function wavelength(room: RoomSnapshot): WavelengthPublic {
  if (room.currentMatch?.gameType !== 'WAVELENGTH') throw new Error('no current Wavelength match');
  return room.currentMatch;
}

export function startCall(room: Room, config: unknown = { cycles: 1 }, player = room.host) {
  return call(room.harness, player, 'POST', `/api/rooms/${room.code}/matches`, {
    gameType: 'WAVELENGTH',
    config,
  });
}

export async function start(room: Room, cycles = 1): Promise<WavelengthPublic> {
  return wavelength((await json<RoomResponse>(startCall(room, { cycles }), 201)).room);
}

export function playerOf(room: Room, playerId: string): CreatePlayerResponse {
  const player = room.players.find((candidate) => candidate.playerId === playerId);
  if (!player) throw new Error(`${playerId} is not a test player`);
  return player;
}

export function psychicOf(room: Room, match: WavelengthPublic): CreatePlayerResponse {
  return playerOf(room, match.psychicId);
}

export function guessersOf(room: Room, match: WavelengthPublic): CreatePlayerResponse[] {
  return match.participants
    .filter((id) => id !== match.psychicId && !match.departedIds.includes(id))
    .map((id) => playerOf(room, id));
}

export async function secretOf(
  room: Room,
  player: CreatePlayerResponse,
  matchId: string,
): Promise<WavelengthSecret | null> {
  const response = call(room.harness, player, 'GET', matchPath(room, matchId, 'me'));
  const { secret } = await json<MatchSecretResponse>(response);
  if (secret && secret.role !== 'PSYCHIC') throw new Error('not a Wavelength secret');
  return secret;
}

export function clueCall(
  room: Room,
  player: CreatePlayerResponse,
  match: WavelengthPublic,
  clue = 'Sopa',
  round = match.round,
) {
  return call(room.harness, player, 'PUT', matchPath(room, match.matchId, 'clue'), {
    round,
    clue,
  });
}

export async function giveClue(room: Room, match: WavelengthPublic, clue = 'Sopa') {
  const response = clueCall(room, psychicOf(room, match), match, clue);
  return wavelength((await json<RoomResponse>(response)).room);
}

export function guessCall(
  room: Room,
  player: CreatePlayerResponse,
  match: WavelengthPublic,
  value: number,
  round = match.round,
) {
  return call(room.harness, player, 'PUT', matchPath(room, match.matchId, 'guess'), {
    round,
    value,
  });
}

export async function guessed(
  room: Room,
  player: CreatePlayerResponse,
  match: WavelengthPublic,
  value: number,
) {
  return wavelength((await json<RoomResponse>(guessCall(room, player, match, value))).room);
}

export async function host(room: Room, match: WavelengthPublic, action: string, body?: unknown) {
  const response = call(
    room.harness,
    room.host,
    'POST',
    matchPath(room, match.matchId, action),
    body ?? { round: match.round },
  );
  return (await json<RoomResponse>(response)).room;
}

export async function playRound(room: Room, match: WavelengthPublic, value = 50) {
  let latest = await giveClue(room, match);
  for (const guesser of guessersOf(room, latest)) {
    latest = await guessed(room, guesser, latest, value);
  }
  return latest;
}
