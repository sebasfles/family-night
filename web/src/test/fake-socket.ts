export class FakeSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeSocket[] = [];
  readonly url: string;
  readonly protocols: string[];
  readyState: number = FakeSocket.CONNECTING;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string, protocols: string[] = []) {
    this.url = url;
    this.protocols = protocols;
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close() {
    this.readyState = FakeSocket.CLOSED;
  }

  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }

  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  serverClose() {
    this.readyState = FakeSocket.CLOSED;
    this.onclose?.();
  }

  push(event: object) {
    this.receive({ type: 'data', id: this.subscription()?.id, event: JSON.stringify(event) });
  }

  subscription() {
    return this.sent.find((message) => message.type === 'subscribe');
  }

  static latest(): FakeSocket {
    const socket = FakeSocket.instances.at(-1);
    if (!socket) throw new Error('no socket was opened');
    return socket;
  }

  acceptSubscription() {
    this.open();
    this.receive({ type: 'connection_ack', connectionTimeoutMs: 300_000 });
    this.receive({ type: 'subscribe_success', id: this.subscription()?.id });
  }
}
