import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import { apiError, me, mockApi, signIn, snapshot } from '../test/app';
import { api, ApiError } from './client';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

describe('the api client', () => {
  test('sends the identity headers and the empty-body hash on a bodyless POST', async () => {
    signIn();
    const mock = mockApi({
      'POST /api/rooms/ABCD/join': () => Response.json({ room: snapshot() }),
    });

    await api.joinRoom('ABCD');

    const headers = mock.calls[0]?.init.headers as Record<string, string>;
    expect(headers).toEqual({
      'x-player-id': me.playerId,
      'x-player-token': me.playerToken,
      'x-amz-content-sha256': sha256(''),
    });
    expect(mock.calls[0]?.init.body).toBeUndefined();
  });

  test('hashes the exact JSON body it sends', async () => {
    signIn();
    const mock = mockApi({
      'POST /api/rooms/ABCD/kick': () => Response.json({ room: snapshot() }),
    });

    await api.kick('ABCD', { playerId: 'p2' });

    const { body, headers } = mock.calls[0]?.init ?? {};
    expect(body).toBe('{"playerId":"p2"}');
    expect(headers).toMatchObject({
      'content-type': 'application/json',
      'x-amz-content-sha256': sha256('{"playerId":"p2"}'),
    });
  });

  test('a PUT vote hashes its body like a POST', async () => {
    signIn();
    const mock = mockApi({
      'PUT /api/rooms/ABCD/matches/M1/votes': () => Response.json({ room: snapshot() }),
    });

    await api.vote('ABCD', 'M1', { round: 2, targetId: 'p2' });

    const { method, body, headers } = mock.calls[0]?.init ?? {};
    expect(method).toBe('PUT');
    expect(body).toBe('{"round":2,"targetId":"p2"}');
    expect(headers).toMatchObject({
      'x-amz-content-sha256': sha256('{"round":2,"targetId":"p2"}'),
    });
  });

  test('a GET carries no body hash', async () => {
    signIn();
    const mock = mockApi({ 'GET /api/rooms/ABCD': () => Response.json({ room: snapshot() }) });

    await api.getRoom('ABCD');

    expect(mock.calls[0]?.init.headers).not.toHaveProperty('x-amz-content-sha256');
  });

  test('away is a keepalive fetch with the usual headers and no body', async () => {
    signIn();
    const mock = mockApi({
      'POST /api/rooms/ABCD/away': () => new Response(null, { status: 204 }),
    });

    await expect(api.away('ABCD')).resolves.toBeUndefined();

    expect(mock.calls[0]?.init).toMatchObject({
      keepalive: true,
      headers: { 'x-player-token': me.playerToken },
    });
  });

  test('a bodyless POST reaches fetch synchronously, so away leaves before the page freezes', () => {
    signIn();
    const mock = mockApi({
      'POST /api/rooms/ABCD/away': () => new Response(null, { status: 204 }),
    });

    void api.away('ABCD');

    expect(mock.calls.map((call) => call.route)).toEqual(['POST /api/rooms/ABCD/away']);
  });

  test('turns the error envelope into an ApiError with the Spanish message', async () => {
    mockApi({
      'POST /api/rooms/ABCD/join': () => apiError(409, 'ROOM_FULL', 'La sala está llena'),
    });

    const error = await api.joinRoom('ABCD').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'ROOM_FULL', status: 409, message: 'La sala está llena' });
  });

  test('a network failure is NETWORK_ERROR and a non-JSON failure keeps its status', async () => {
    mockApi({ 'GET /api/rooms/ABCD': () => new Response('<html>', { status: 502 }) });
    await expect(api.getRoom('ABCD')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 502,
    });

    const mock = mockApi();
    mock.on('GET /api/players/me', () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(api.me()).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
