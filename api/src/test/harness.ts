import { randomUUID } from 'node:crypto';
import { CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  PLAYER_ID_HEADER,
  PLAYER_TOKEN_HEADER,
  type CreatePlayerResponse,
  type ErrorResponse,
  type RandomInt,
  type RoomEvent,
  type RoomResponse,
  type RoomSnapshot,
} from '@family-night/shared';
import { expect, inject } from 'vitest';
import { createApp } from '../app.ts';
import { createRepos, cryptoRandomInt, type Deps } from '../deps.ts';
import type { TableNames } from '../repos/db.ts';

const keys: Record<keyof TableNames, { hash: string; range?: string }> = {
  players: { hash: 'playerId' },
  playerNames: { hash: 'name' },
  rooms: { hash: 'roomCode' },
  roomMembers: { hash: 'roomCode', range: 'playerId' },
  matches: { hash: 'roomCode', range: 'matchId' },
  matchSecrets: { hash: 'matchId', range: 'playerId' },
  votes: { hash: 'matchId', range: 'roundVoter' },
};

export function localClient(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({
      endpoint: inject('dynamoEndpoint'),
      region: 'us-east-1',
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
}

export async function createTables(client: DynamoDBDocumentClient): Promise<TableNames> {
  const suffix = randomUUID().slice(0, 8);
  const tables = {} as TableNames;
  for (const [table, key] of Object.entries(keys) as [
    keyof TableNames,
    (typeof keys)[keyof TableNames],
  ][]) {
    const name = `test-${suffix}-${table}`;
    const attributes = [key.hash, ...(key.range ? [key.range] : [])];
    await client.send(
      new CreateTableCommand({
        TableName: name,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: attributes.map((AttributeName) => ({
          AttributeName,
          AttributeType: 'S',
        })),
        KeySchema: [
          { AttributeName: key.hash, KeyType: 'HASH' },
          ...(key.range ? [{ AttributeName: key.range, KeyType: 'RANGE' as const }] : []),
        ],
      }),
    );
    tables[table] = name;
  }
  return tables;
}

export interface Published {
  roomCode: string;
  events: RoomEvent[];
}

export interface Harness {
  deps: Deps;
  app: ReturnType<typeof createApp>;
  tables: TableNames;
  client: DynamoDBDocumentClient;
  published: Published[];
  advance: (ms: number) => void;
  now: () => number;
}

export async function createHarness(
  options: { random?: () => number; secureRandomInt?: RandomInt } = {},
): Promise<Harness> {
  const client = localClient();
  const tables = await createTables(client);
  const published: Published[] = [];
  let now = Date.now();
  const deps: Deps = {
    repos: createRepos(client, tables),
    publish: (roomCode, events) => {
      published.push({ roomCode, events });
      return Promise.resolve();
    },
    clock: () => now,
    random: options.random ?? Math.random,
    secureRandomInt: options.secureRandomInt ?? cryptoRandomInt,
  };
  return {
    deps,
    app: createApp(deps),
    tables,
    client,
    published,
    advance: (ms) => {
      now += ms;
    },
    now: () => now,
  };
}

export function authHeaders(player: CreatePlayerResponse): Record<string, string> {
  return { [PLAYER_ID_HEADER]: player.playerId, [PLAYER_TOKEN_HEADER]: player.playerToken };
}

export async function newPlayer(harness: Harness): Promise<CreatePlayerResponse> {
  const response = await harness.app.request('/api/players', { method: 'POST' });
  if (response.status !== 200)
    throw new Error(`POST /api/players answered ${String(response.status)}`);
  return (await response.json()) as CreatePlayerResponse;
}

export function call(
  harness: Harness,
  player: CreatePlayerResponse,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH',
  path: string,
  body?: unknown,
): Promise<Response> {
  return Promise.resolve(
    harness.app.request(path, {
      method,
      headers: {
        ...authHeaders(player),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export async function json<T>(response: Response | Promise<Response>, status = 200): Promise<T> {
  const resolved = await response;
  const body = (await resolved.json()) as T;
  expect(resolved.status, JSON.stringify(body)).toBe(status);
  return body;
}

export async function createRoom(
  harness: Harness,
  player: CreatePlayerResponse,
): Promise<RoomSnapshot> {
  return (await json<RoomResponse>(call(harness, player, 'POST', '/api/rooms'), 201)).room;
}

export async function join(harness: Harness, player: CreatePlayerResponse, code: string) {
  return (await json<RoomResponse>(call(harness, player, 'POST', `/api/rooms/${code}/join`))).room;
}

export async function getRoom(harness: Harness, player: CreatePlayerResponse, code: string) {
  return (await json<RoomResponse>(call(harness, player, 'GET', `/api/rooms/${code}`))).room;
}

export async function expectError(response: Promise<Response>, status: number, code: string) {
  const body = await json<ErrorResponse>(response, status);
  expect(body.error.code).toBe(code);
  return body.error;
}

export function updates(harness: Harness): RoomSnapshot[] {
  return harness.published.flatMap(({ events }) =>
    events.flatMap((event) => (event.type === 'room.updated' ? [event.room] : [])),
  );
}

export async function roomWith(count: number, options: { secureRandomInt?: RandomInt } = {}) {
  const harness = await createHarness(options);
  const players: CreatePlayerResponse[] = [];
  for (let i = 0; i < count; i++) players.push(await newPlayer(harness));
  const member = (index: number): CreatePlayerResponse => {
    const player = players[index];
    if (!player) throw new Error(`no player ${String(index)}`);
    return player;
  };
  const host = member(0);
  const room = await createRoom(harness, host);
  for (const player of players.slice(1)) {
    harness.advance(10);
    await join(harness, player, room.roomCode);
  }
  return { harness, players, member, host, code: room.roomCode };
}
