import { GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  PLAYER_ID_HEADER,
  PLAYER_TOKEN_HEADER,
  type ErrorResponse,
  type MeResponse,
} from '@family-night/shared';
import { describe, expect, test } from 'vitest';
import names from '../data/names.json' with { type: 'json' };
import { authHeaders, createHarness, newPlayer } from '../test/harness.ts';

const firstName = `${names.animals[0] ?? ''} ${names.adjectives[0] ?? ''}`;

describe('POST /api/players', () => {
  test('creates a player with a token and a name, storing only the token hash', async () => {
    const harness = await createHarness();
    const player = await newPlayer(harness);

    expect(player.playerId).toMatch(/^[0-9a-f-]{36}$/);
    expect(player.playerToken).toMatch(/^[\w-]{43}$/);
    expect(player.name).toMatch(/^\p{Lu}\p{Ll}+ \p{Lu}\p{Ll}+$/u);

    const { Item } = await harness.client.send(
      new GetCommand({ TableName: harness.tables.players, Key: { playerId: player.playerId } }),
    );
    expect(Item?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(Item)).not.toContain(player.playerToken);
    const { Item: claimed } = await harness.client.send(
      new GetCommand({ TableName: harness.tables.playerNames, Key: { name: player.name } }),
    );
    expect(claimed?.playerId).toBe(player.playerId);
  });

  test('a taken name is retried with another combination', async () => {
    const draws = [0, 0, 0, 0, 0.5, 0.5];
    const harness = await createHarness({ random: () => draws.shift() ?? 0.9 });

    const first = await newPlayer(harness);
    const second = await newPlayer(harness);

    expect(first.name).toBe(firstName);
    expect(second.name).toBe(`${names.animals[50] ?? ''} ${names.adjectives[50] ?? ''}`);
  });

  test('after 20 collisions the name gets a number from 2', async () => {
    const harness = await createHarness({ random: () => 0 });

    const names = [];
    for (let i = 0; i < 3; i++) names.push((await newPlayer(harness)).name);

    expect(names).toEqual([firstName, `${firstName} 2`, `${firstName} 3`]);
  });
});

describe('GET /api/players/me', () => {
  test('answers the stored identity', async () => {
    const harness = await createHarness();
    const player = await newPlayer(harness);

    const response = await harness.app.request('/api/players/me', { headers: authHeaders(player) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual<MeResponse>({
      playerId: player.playerId,
      name: player.name,
    });
  });

  test.each([
    ['no headers', {}],
    ['a wrong token', { token: 'x'.repeat(43) }],
    ['an unknown player', { id: '00000000-0000-4000-8000-000000000000' }],
    ['a malformed id', { id: 'nope' }],
  ])('answers 401 UNAUTHORIZED for %s', async (_, override: { id?: string; token?: string }) => {
    const harness = await createHarness();
    const player = await newPlayer(harness);
    const headers =
      Object.keys(override).length === 0
        ? {}
        : {
            [PLAYER_ID_HEADER]: override.id ?? player.playerId,
            [PLAYER_TOKEN_HEADER]: override.token ?? player.playerToken,
          };

    const response = await harness.app.request('/api/players/me', { headers });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual<ErrorResponse>({
      error: { code: 'UNAUTHORIZED', message: 'No pudimos reconocer este celular' },
    });
  });
});
