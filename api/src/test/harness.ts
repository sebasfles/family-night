import { randomUUID } from 'node:crypto';
import { CreateTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  PLAYER_ID_HEADER,
  PLAYER_TOKEN_HEADER,
  type CreatePlayerResponse,
  type RoomEvent,
} from '@family-night/shared';
import { inject } from 'vitest';
import { createApp } from '../app.ts';
import { createRepos, type Deps } from '../deps.ts';
import type { TableNames } from '../repos/db.ts';

const keys: Record<keyof TableNames, { hash: string; range?: string }> = {
  players: { hash: 'playerId' },
  playerNames: { hash: 'name' },
  rooms: { hash: 'roomCode' },
  roomMembers: { hash: 'roomCode', range: 'playerId' },
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

export async function createHarness(options: { random?: () => number } = {}): Promise<Harness> {
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
  method: 'GET' | 'POST',
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
