import type { RoomEvent } from '@family-night/shared';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { snapshot } from '../test/app';
import { BACKOFF_MAX_MS, realtimeConfigFromEnv, RoomChannel } from './client';

class FakeSocket {
  static instances: FakeSocket[] = [];
  readonly url: string;
  readonly protocols: string[];
  readyState: number = WebSocket.CONNECTING;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string, protocols: string[]) {
    this.url = url;
    this.protocols = protocols;
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }

  open() {
    this.readyState = WebSocket.OPEN;
    this.onopen?.();
  }

  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  serverClose() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }

  subscription() {
    return this.sent.find((message) => message.type === 'subscribe');
  }

  acceptSubscription() {
    this.open();
    this.receive({ type: 'connection_ack', connectionTimeoutMs: 300_000 });
    this.receive({ type: 'subscribe_success', id: this.subscription()?.id });
  }
}

const config = {
  httpDomain: 'abc.appsync-api.us-east-1.amazonaws.com',
  realtimeDomain: 'abc.appsync-realtime-api.us-east-1.amazonaws.com',
};
const token = '11111111-1111-4111-8111-111111111111:secret-token';

function decodeHeader(protocol: string): unknown {
  const base64 = protocol.slice('header-'.length).replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
}

function start() {
  const events: RoomEvent[] = [];
  const onSubscribed = vi.fn();
  const channel = new RoomChannel({
    config,
    token,
    channel: '/rooms/ABCD',
    onEvent: (event) => events.push(event),
    onSubscribed,
    createSocket: (url, protocols) => new FakeSocket(url, protocols) as unknown as WebSocket,
  });
  channel.start();
  return { channel, events, onSubscribed, socket: () => FakeSocket.instances.at(-1) };
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('handshake', () => {
  test('connects with the AppSync subprotocol and the Lambda authorization header', () => {
    const { socket } = start();
    const [protocol, header] = socket()?.protocols ?? [];

    expect(socket()?.url).toBe(`wss://${config.realtimeDomain}/event/realtime`);
    expect(protocol).toBe('aws-appsync-event-ws');
    expect(header).toMatch(/^header-[\w-]+$/);
    expect(decodeHeader(header ?? '')).toEqual({ Authorization: token, host: config.httpDomain });
  });

  test('sends connection_init on open and subscribes to the room channel after the ack', () => {
    const { socket, onSubscribed } = start();
    socket()?.open();
    expect(socket()?.sent).toEqual([{ type: 'connection_init' }]);

    socket()?.receive({ type: 'connection_ack', connectionTimeoutMs: 300_000 });
    const subscribe = socket()?.subscription();
    expect(subscribe).toEqual({
      type: 'subscribe',
      id: expect.stringMatching(/^[\w-]{1,128}$/) as unknown,
      channel: '/rooms/ABCD',
      authorization: { Authorization: token, host: config.httpDomain },
    });

    socket()?.receive({ type: 'subscribe_success', id: subscribe?.id });
    expect(onSubscribed).toHaveBeenCalledOnce();
  });
});

describe('events', () => {
  test('parses data messages for its subscription, as a string or an array of strings', () => {
    const { socket, events } = start();
    socket()?.acceptSubscription();
    const id = socket()?.subscription()?.id;
    const updated: RoomEvent = { type: 'room.updated', room: snapshot() };
    const kicked: RoomEvent = { type: 'member.kicked', playerId: 'p2' };

    socket()?.receive({ type: 'data', id, event: JSON.stringify(updated) });
    socket()?.receive({ type: 'data', id, event: [JSON.stringify(kicked)] });
    socket()?.receive({ type: 'data', id: 'other', event: JSON.stringify(kicked) });
    socket()?.receive({ type: 'data', id, event: '{"type":"unknown"}' });
    socket()?.receive({ type: 'data', id, event: 'not json' });

    expect(events).toEqual([updated, kicked]);
  });
});

describe('reconnection', () => {
  test('backs off 1 s, 2 s, 4 s and resubscribes, resetting after a success', () => {
    const { socket, onSubscribed } = start();
    socket()?.serverClose();

    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);

    socket()?.serverClose();
    vi.advanceTimersByTime(1_999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);

    socket()?.acceptSubscription();
    expect(onSubscribed).toHaveBeenCalledOnce();
    socket()?.serverClose();
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(4);
  });

  test('the backoff caps at 30 s', () => {
    const { socket } = start();
    for (let i = 0; i < 8; i++) {
      socket()?.serverClose();
      vi.advanceTimersByTime(BACKOFF_MAX_MS);
    }
    const count = FakeSocket.instances.length;
    socket()?.serverClose();
    vi.advanceTimersByTime(BACKOFF_MAX_MS - 1);
    expect(FakeSocket.instances).toHaveLength(count);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(count + 1);
  });

  test('a subscribe error drops the socket and retries', () => {
    const { socket } = start();
    const first = socket();
    first?.open();
    first?.receive({ type: 'connection_ack' });
    first?.receive({ type: 'subscribe_error', id: first.subscription()?.id });

    expect(first?.readyState).toBe(WebSocket.CLOSED);
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  test('a silent connection past its keep-alive timeout is dropped and reconnected', () => {
    const { socket } = start();
    socket()?.open();
    socket()?.receive({ type: 'connection_ack', connectionTimeoutMs: 10_000 });
    vi.advanceTimersByTime(9_000);
    socket()?.receive({ type: 'ka' });
    vi.advanceTimersByTime(9_000);
    expect(FakeSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1_000);
    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });

  test('reconnectNow skips the backoff when the channel is down, and does nothing when up', () => {
    const { channel, socket } = start();
    socket()?.serverClose();
    channel.reconnectNow();
    expect(FakeSocket.instances).toHaveLength(2);

    socket()?.acceptSubscription();
    channel.reconnectNow();
    expect(FakeSocket.instances).toHaveLength(2);
  });

  test('stop closes the socket and never reconnects', () => {
    const { channel, socket } = start();
    const first = socket();
    first?.acceptSubscription();

    channel.stop();
    vi.advanceTimersByTime(BACKOFF_MAX_MS * 2);

    expect(first?.readyState).toBe(WebSocket.CLOSED);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});

test('without both domains there is no realtime config, so the app runs without it', () => {
  expect(realtimeConfigFromEnv({})).toBeNull();
  expect(realtimeConfigFromEnv({ VITE_EVENTS_HTTP_DOMAIN: 'a' })).toBeNull();
  expect(
    realtimeConfigFromEnv({ VITE_EVENTS_HTTP_DOMAIN: 'a', VITE_EVENTS_REALTIME_DOMAIN: 'b' }),
  ).toEqual({ httpDomain: 'a', realtimeDomain: 'b' });
});
