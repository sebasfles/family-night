import type { RoomEvent } from '@family-night/shared';
import { afterEach, expect, test, vi } from 'vitest';
import { createAppSyncPublisher } from './publish.ts';

const domain = 'example123.appsync-api.us-east-1.amazonaws.com';
const credentials = () =>
  Promise.resolve({
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'secret',
    sessionToken: 'session',
  });
const event: RoomEvent = { type: 'member.kicked', playerId: 'p1' };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

test('posts the events as JSON strings to the room channel, signed for appsync', async () => {
  const fetchMock = stubFetch(Response.json({ successful: [{ index: 0 }], failed: [] }));
  vi.spyOn(console, 'log').mockImplementation(() => undefined);

  await createAppSyncPublisher(domain, 'us-east-1', credentials)('ABCD', [event]);

  const [url, init] = fetchMock.mock.calls[0] ?? [];
  expect(url).toBe(`https://${domain}/event`);
  expect(init?.method).toBe('POST');
  expect(JSON.parse(init?.body as string)).toEqual({
    channel: '/rooms/ABCD',
    events: [JSON.stringify(event)],
  });
  const headers = init?.headers as Record<string, string>;
  expect(headers.authorization).toMatch(
    /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/appsync\/aws4_request, SignedHeaders=[^,]*host[^,]*, Signature=[0-9a-f]{64}$/,
  );
  expect(headers['x-amz-security-token']).toBe('session');
});

test.each([
  ['a network error', new Error('socket hang up')],
  ['an error status', new Response('{}', { status: 403 })],
  ['failed events', Response.json({ successful: [], failed: [{ index: 0 }] })],
])('logs %s and never throws', async (_, response) => {
  stubFetch(response);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  await expect(
    createAppSyncPublisher(domain, 'us-east-1', credentials)('ABCD', [event]),
  ).resolves.toBeUndefined();

  expect(errors).toHaveBeenCalledOnce();
  expect(JSON.parse(String(errors.mock.calls[0]?.[0]))).toMatchObject({
    msg: 'publish failed',
    channel: '/rooms/ABCD',
    types: ['member.kicked'],
  });
});
