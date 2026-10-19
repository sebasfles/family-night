import type {
  CreatePlayerResponse,
  ManadaConfig,
  ManadaPublic,
  ManadaSecret,
  MatchSecretResponse,
  RoomResponse,
  RoomSnapshot,
} from '@family-night/shared';
import { call, json } from './harness.ts';
import { matchPath, type Room } from './impostor.ts';

export function manada(room: RoomSnapshot): ManadaPublic {
  if (room.currentMatch?.gameType !== 'MANADA') throw new Error('no current La manada match');
  return room.currentMatch;
}

export function startCall(
  room: Room,
  config: unknown = { goal: 'ROUNDS', rounds: 5 },
  player = room.host,
) {
  return call(room.harness, player, 'POST', `/api/rooms/${room.code}/matches`, {
    gameType: 'MANADA',
    config,
  });
}

export async function start(
  room: Room,
  config: ManadaConfig = { goal: 'ROUNDS', rounds: 5 },
): Promise<ManadaPublic> {
  return manada((await json<RoomResponse>(startCall(room, config), 201)).room);
}

export function answerCall(
  room: Room,
  player: CreatePlayerResponse,
  match: { matchId: string; round: number },
  answer: string,
  round = match.round,
) {
  return call(room.harness, player, 'PUT', matchPath(room, match.matchId, 'answer'), {
    round,
    answer,
  });
}

export async function answered(
  room: Room,
  player: CreatePlayerResponse,
  match: ManadaPublic,
  answer: string,
): Promise<ManadaPublic> {
  return manada((await json<RoomResponse>(answerCall(room, player, match, answer))).room);
}

export function hostCall(
  room: Room,
  match: { matchId: string; round: number },
  action: string,
  body: Record<string, unknown> = {},
  player = room.host,
) {
  return call(room.harness, player, 'POST', matchPath(room, match.matchId, action), {
    round: match.round,
    ...body,
  });
}

export async function hosted(
  room: Room,
  match: ManadaPublic,
  action: string,
  body: Record<string, unknown> = {},
): Promise<ManadaPublic> {
  return manada((await json<RoomResponse>(hostCall(room, match, action, body))).room);
}

export async function everyoneAnswers(
  room: Room,
  match: ManadaPublic,
  answers: readonly (string | undefined)[],
): Promise<ManadaPublic> {
  let latest = match;
  for (const [index, playerId] of match.participants.entries()) {
    const answer = answers[index];
    const player = room.players.find((candidate) => candidate.playerId === playerId);
    if (answer === undefined || !player) continue;
    latest = await answered(room, player, latest, answer);
  }
  return latest;
}

export async function secretOf(
  room: Room,
  player: CreatePlayerResponse,
  matchId: string,
): Promise<ManadaSecret | null> {
  const response = call(room.harness, player, 'GET', matchPath(room, matchId, 'me'));
  const { secret } = await json<MatchSecretResponse>(response);
  if (secret && secret.role !== 'ANSWERER') throw new Error('not a La manada secret');
  return secret;
}
