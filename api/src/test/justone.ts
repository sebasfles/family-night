import type {
  CreatePlayerResponse,
  JustOnePublic,
  JustOneSecret,
  MatchSecretResponse,
  RoomResponse,
  RoomSnapshot,
} from '@family-night/shared';
import { call, json } from './harness.ts';
import { matchPath, type Room } from './impostor.ts';

export function justOne(room: RoomSnapshot): JustOnePublic {
  if (room.currentMatch?.gameType !== 'JUST_ONE') throw new Error('no current Just One match');
  return room.currentMatch;
}

export function startCall(room: Room, config: unknown = { cycles: 1 }, player = room.host) {
  return call(room.harness, player, 'POST', `/api/rooms/${room.code}/matches`, {
    gameType: 'JUST_ONE',
    config,
  });
}

export async function start(room: Room, cycles = 1): Promise<JustOnePublic> {
  return justOne((await json<RoomResponse>(startCall(room, { cycles }), 201)).room);
}

export function playerOf(room: Room, playerId: string): CreatePlayerResponse {
  const player = room.players.find((candidate) => candidate.playerId === playerId);
  if (!player) throw new Error(`${playerId} is not a test player`);
  return player;
}

export function guesserOf(room: Room, match: JustOnePublic): CreatePlayerResponse {
  return playerOf(room, match.guesserId);
}

export function clueGiversOf(room: Room, match: JustOnePublic): CreatePlayerResponse[] {
  return match.participants
    .filter((id) => id !== match.guesserId && !match.departedIds.includes(id))
    .map((id) => playerOf(room, id));
}

export function firstClueGiver(room: Room, match: JustOnePublic): CreatePlayerResponse {
  const [giver] = clueGiversOf(room, match);
  if (!giver) throw new Error('no clue-giver');
  return giver;
}

export async function secretOf(
  room: Room,
  player: CreatePlayerResponse,
  matchId: string,
): Promise<JustOneSecret | null> {
  const response = call(room.harness, player, 'GET', matchPath(room, matchId, 'me'));
  const { secret } = await json<MatchSecretResponse>(response);
  if (secret && secret.role !== 'CLUE_GIVER') throw new Error('not a Just One secret');
  return secret;
}

export async function wordOf(room: Room, match: JustOnePublic): Promise<string> {
  const secret = await secretOf(room, firstClueGiver(room, match), match.matchId);
  if (!secret) throw new Error('no word for the clue-givers');
  return secret.word;
}

export function act(
  room: Room,
  player: CreatePlayerResponse,
  match: { matchId: string; round: number },
  action: string,
  body: Record<string, unknown> = {},
) {
  const method = ['clue', 'guess', 'cancel-clue'].includes(action) ? 'PUT' : 'POST';
  return call(room.harness, player, method, matchPath(room, match.matchId, action), {
    round: match.round,
    ...body,
  });
}

export async function acted(
  room: Room,
  player: CreatePlayerResponse,
  match: JustOnePublic,
  action: string,
  body: Record<string, unknown> = {},
): Promise<JustOnePublic> {
  return justOne((await json<RoomResponse>(act(room, player, match, action, body))).room);
}

export function clueCall(
  room: Room,
  player: CreatePlayerResponse,
  match: JustOnePublic,
  clue: string,
  round = match.round,
) {
  return act(room, player, match, 'clue', { clue, round });
}

export async function gaveClue(
  room: Room,
  player: CreatePlayerResponse,
  match: JustOnePublic,
  clue: string,
): Promise<JustOnePublic> {
  return acted(room, player, match, 'clue', { clue });
}

export function host(room: Room, match: JustOnePublic, action: string, body = {}) {
  return acted(room, room.host, match, action, body);
}

export function distinctClue(index: number): string {
  return `Pista${String.fromCharCode(97 + index)}`;
}

export async function everyoneGivesClues(room: Room, match: JustOnePublic, texts?: string[]) {
  let latest = match;
  for (const [index, giver] of clueGiversOf(room, match).entries()) {
    latest = await gaveClue(room, giver, latest, texts?.[index] ?? distinctClue(index));
  }
  return latest;
}

export async function toGuess(room: Room, match: JustOnePublic): Promise<JustOnePublic> {
  const review = await everyoneGivesClues(room, match);
  return acted(room, firstClueGiver(room, review), review, 'show-clues');
}

export async function playRound(
  room: Room,
  match: JustOnePublic,
  guess: 'CORRECT' | 'WRONG' | 'PASS',
): Promise<JustOnePublic> {
  const word = await wordOf(room, match);
  const guessing = await toGuess(room, match);
  const text = { CORRECT: word, WRONG: 'Zzzz', PASS: null }[guess];
  return acted(room, guesserOf(room, guessing), guessing, 'guess', { guess: text });
}
