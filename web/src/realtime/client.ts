import type { RoomEvent } from '@family-night/shared';

export interface RealtimeConfig {
  httpDomain: string;
  realtimeDomain: string;
}

export function realtimeConfigFromEnv(
  env: Record<string, string | undefined> = import.meta.env,
): RealtimeConfig | null {
  const httpDomain = env.VITE_EVENTS_HTTP_DOMAIN;
  const realtimeDomain = env.VITE_EVENTS_REALTIME_DOMAIN;
  return httpDomain && realtimeDomain ? { httpDomain, realtimeDomain } : null;
}

export const BACKOFF_MIN_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 300_000;
const EVENT_TYPES = new Set<string>(['room.updated', 'member.kicked', 'room.closed']);

export type SocketFactory = (url: string, protocols: string[]) => WebSocket;

export interface RoomChannelOptions {
  config: RealtimeConfig;
  token: string;
  channel: string;
  onEvent: (event: RoomEvent) => void;
  onSubscribed: () => void;
  createSocket?: SocketFactory;
}

interface ServerMessage {
  type?: string;
  id?: string;
  connectionTimeoutMs?: number;
  event?: unknown;
}

function base64Url(text: string): string {
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseEvents(payload: unknown): RoomEvent[] {
  const raw = Array.isArray(payload) ? payload : [payload];
  return raw.flatMap((item) => {
    try {
      const event: unknown = typeof item === 'string' ? JSON.parse(item) : item;
      const type = (event as { type?: unknown } | null)?.type;
      return typeof type === 'string' && EVENT_TYPES.has(type) ? [event as RoomEvent] : [];
    } catch {
      return [];
    }
  });
}

export class RoomChannel {
  private readonly options: RoomChannelOptions;
  private readonly createSocket: SocketFactory;
  private socket: WebSocket | null = null;
  private subscriptionId = '';
  private subscribed = false;
  private stopped = true;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private keepAliveTimer: ReturnType<typeof setTimeout> | undefined;
  private connectionTimeoutMs = DEFAULT_CONNECTION_TIMEOUT_MS;

  constructor(options: RoomChannelOptions) {
    this.options = options;
    this.createSocket = options.createSocket ?? ((url, protocols) => new WebSocket(url, protocols));
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    this.detach();
  }

  reconnectNow(): void {
    if (this.stopped || this.subscribed) return;
    this.attempt = 0;
    this.connect();
  }

  private get authorization() {
    return { Authorization: this.options.token, host: this.options.config.httpDomain };
  }

  private connect(): void {
    clearTimeout(this.reconnectTimer);
    this.detach();
    const socket = this.createSocket(`wss://${this.options.config.realtimeDomain}/event/realtime`, [
      'aws-appsync-event-ws',
      `header-${base64Url(JSON.stringify(this.authorization))}`,
    ]);
    this.socket = socket;
    socket.onopen = () => {
      this.send({ type: 'connection_init' });
    };
    socket.onmessage = (message: MessageEvent) => {
      this.handle(String(message.data));
    };
    socket.onclose = () => {
      this.drop();
    };
    socket.onerror = () => {
      this.drop();
    };
    this.watchKeepAlive();
  }

  private handle(raw: string): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(raw) as ServerMessage;
    } catch {
      return;
    }
    switch (message.type) {
      case 'connection_ack':
        this.connectionTimeoutMs = message.connectionTimeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
        this.watchKeepAlive();
        this.subscriptionId = crypto.randomUUID();
        this.send({
          type: 'subscribe',
          id: this.subscriptionId,
          channel: this.options.channel,
          authorization: this.authorization,
        });
        return;
      case 'ka':
        this.watchKeepAlive();
        return;
      case 'subscribe_success':
        if (message.id !== this.subscriptionId) return;
        this.attempt = 0;
        this.subscribed = true;
        this.options.onSubscribed();
        return;
      case 'data':
        if (message.id !== this.subscriptionId) return;
        for (const event of parseEvents(message.event)) this.options.onEvent(event);
        return;
      case 'subscribe_error':
      case 'connection_error':
      case 'error':
        this.drop();
        return;
    }
  }

  private send(message: object): void {
    this.socket?.send(JSON.stringify(message));
  }

  private watchKeepAlive(): void {
    clearTimeout(this.keepAliveTimer);
    this.keepAliveTimer = setTimeout(() => {
      this.drop();
    }, this.connectionTimeoutMs);
  }

  private detach(): void {
    clearTimeout(this.keepAliveTimer);
    const socket = this.socket;
    this.socket = null;
    this.subscribed = false;
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  }

  private drop(): void {
    this.detach();
    if (this.stopped) return;
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** this.attempt);
    this.attempt++;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
