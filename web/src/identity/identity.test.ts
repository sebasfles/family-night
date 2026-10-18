import { describe, expect, test } from 'vitest';
import { apiError, me, mockApi, signIn } from '../test/app';
import { bootstrapIdentity } from './identity';
import { loadIdentity } from './storage';

const fresh = {
  playerId: '22222222-2222-4222-8222-222222222222',
  playerToken: 't2',
  name: 'Oso Sabio',
};

describe('bootstrapIdentity', () => {
  test('a first visit creates a player and stores it', async () => {
    const mock = mockApi({ 'POST /api/players': () => Response.json(fresh) });

    expect(await bootstrapIdentity()).toEqual(fresh);
    expect(loadIdentity()).toEqual(fresh);
    expect(mock.calls.map((call) => call.route)).toEqual(['POST /api/players']);
  });

  test('a stored identity is validated and kept', async () => {
    signIn();
    const mock = mockApi({
      'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
    });

    expect(await bootstrapIdentity()).toEqual(me);
    expect(mock.calls.map((call) => call.route)).toEqual(['GET /api/players/me']);
  });

  test('a 401 starts over with a new player', async () => {
    signIn();
    mockApi({
      'GET /api/players/me': () =>
        apiError(401, 'UNAUTHORIZED', 'No pudimos reconocer este celular'),
      'POST /api/players': () => Response.json(fresh),
    });

    expect(await bootstrapIdentity()).toEqual(fresh);
    expect(loadIdentity()).toEqual(fresh);
  });

  test.each([
    ['a server error', () => apiError(500, 'INTERNAL_ERROR', 'Algo salió mal')],
    ['a proxy error without envelope', () => new Response('<html>', { status: 401 })],
    [
      'a network error',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])('%s keeps the stored identity and fails', async (_, handler) => {
    signIn();
    const mock = mockApi({ 'GET /api/players/me': handler });

    await expect(bootstrapIdentity()).rejects.toBeDefined();
    expect(loadIdentity()).toEqual(me);
    expect(mock.calls.map((call) => call.route)).toEqual(['GET /api/players/me']);
  });
});
