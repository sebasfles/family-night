import type { RoomEvent, RoomSnapshot } from '@family-night/shared';
import { act, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { me, member, mockApi, renderApp, signIn, snapshot } from '../../test/app';
import { FakeSocket } from '../../test/fake-socket';

const guest = member({ playerId: '22222222-2222-4222-8222-222222222222', name: 'Zorro Astuto' });

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return snapshot({
    members: [member({ playerId: me.playerId, name: me.name }), guest],
    ...overrides,
  });
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubEnv('VITE_EVENTS_HTTP_DOMAIN', 'abc.appsync-api.us-east-1.amazonaws.com');
  vi.stubEnv('VITE_EVENTS_REALTIME_DOMAIN', 'abc.appsync-realtime-api.us-east-1.amazonaws.com');
  vi.stubGlobal('WebSocket', FakeSocket);
});

async function enterSubscribed(served: RoomSnapshot = room()) {
  signIn();
  const mock = mockApi({
    'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
    'POST /api/rooms/ABCD/join': () => Response.json({ room: served }),
    'GET /api/rooms/ABCD': () => Response.json({ room: served }),
  });
  const app = renderApp('/ABCD');
  await screen.findByText('ABCD');
  act(() => {
    FakeSocket.latest().acceptSubscription();
  });
  return { ...app, mock };
}

function push(event: RoomEvent) {
  act(() => {
    FakeSocket.latest().push(event);
  });
}

const roomGets = (mock: { calls: { route: string }[] }) =>
  mock.calls.filter((call) => call.route === 'GET /api/rooms/ABCD').length;

test('the room channel subscribes with the player credentials', async () => {
  await enterSubscribed();

  expect(FakeSocket.latest().subscription()).toMatchObject({
    channel: '/rooms/ABCD',
    authorization: { Authorization: `${me.playerId}:${me.playerToken}` },
  });
});

test('member.kicked for this phone sends it home with a message', async () => {
  const { router } = await enterSubscribed();

  push({ type: 'member.kicked', playerId: guest.playerId });
  expect(router.state.location.pathname).toBe('/ABCD');

  push({ type: 'member.kicked', playerId: me.playerId });

  expect(await screen.findByText('Te sacaron de la sala')).toBeVisible();
  expect(router.state.location.pathname).toBe('/');
});

test('room.updated is applied only when its version is newer', async () => {
  await enterSubscribed(room({ version: 3 }));

  push({ type: 'room.updated', room: room({ version: 4, hostId: guest.playerId }) });
  expect(await screen.findByText('El host elegirá el juego.')).toBeVisible();

  push({ type: 'room.updated', room: room({ version: 2, hostId: me.playerId }) });
  expect(screen.getByText('El host elegirá el juego.')).toBeVisible();
});

test('every subscribe_success, after a reconnect too, refetches the room', async () => {
  const { mock } = await enterSubscribed();
  await waitFor(() => {
    expect(roomGets(mock)).toBe(1);
  });

  act(() => {
    FakeSocket.latest().serverClose();
  });
  await waitFor(
    () => {
      expect(FakeSocket.instances).toHaveLength(2);
    },
    { timeout: 2_000 },
  );
  act(() => {
    FakeSocket.latest().acceptSubscription();
  });

  await waitFor(() => {
    expect(roomGets(mock)).toBe(2);
  });
});
