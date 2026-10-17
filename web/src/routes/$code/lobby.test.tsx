import { ONLINE_WINDOW_MS, PRESENCE_RECOMPUTE_MS, type RoomSnapshot } from '@family-night/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { apiError, me, member, mockApi, renderApp, signIn, snapshot } from '../../test/app';

const guest = member({ playerId: '22222222-2222-4222-8222-222222222222', name: 'Zorro Astuto' });
const away = member({
  playerId: '33333333-3333-4333-8333-333333333333',
  name: 'Oso Sabio',
  online: false,
  lastSeenAt: new Date(Date.now() - 2 * ONLINE_WINDOW_MS).toISOString(),
});

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return snapshot({
    members: [member({ playerId: me.playerId, name: me.name }), guest, away],
    ...overrides,
  });
}

function enterRoom(path: string, snapshotToServe: RoomSnapshot = room()) {
  signIn();
  const mock = mockApi({
    'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
    'POST /api/rooms/ABCD/join': () => Response.json({ room: snapshotToServe }),
    'GET /api/rooms/ABCD': () => Response.json({ room: snapshotToServe }),
  });
  return { ...renderApp(path), mock };
}

function stubNavigator(key: 'clipboard' | 'share', value: unknown) {
  Object.defineProperty(navigator, key, { configurable: true, value });
  onTestFinished(() => {
    Reflect.deleteProperty(navigator, key);
  });
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  onTestFinished(() => {
    Reflect.deleteProperty(document, 'visibilityState');
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('entering a room', () => {
  test('a lowercase link normalizes to the uppercase room and joins it', async () => {
    const { router, mock } = enterRoom('/abcd');

    expect(await screen.findByText('ABCD')).toBeVisible();
    expect(router.state.location.pathname).toBe('/ABCD');
    expect(mock.calls.map((call) => call.route)).toContain('POST /api/rooms/ABCD/join');
  });

  test('a malformed code goes home', async () => {
    const { router } = enterRoom('/ABCO');

    expect(await screen.findByRole('button', { name: 'Crear sala' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
  });

  test('an unknown room shows the not-found message with a create button', async () => {
    signIn();
    mockApi({
      'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
      'POST /api/rooms/ZZZZ/join': () =>
        apiError(404, 'ROOM_NOT_FOUND', 'Esta sala no existe o ya expiró'),
    });

    renderApp('/ZZZZ');

    expect(
      await screen.findByRole('heading', { name: 'Esta sala no existe o ya expiró' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Crear una sala nueva' })).toBeEnabled();
  });

  test('a full room shows the server message', async () => {
    signIn();
    mockApi({
      'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
      'POST /api/rooms/ABCD/join': () =>
        apiError(409, 'ROOM_FULL', 'La sala está llena, ya hay 20 jugadores'),
    });

    renderApp('/ABCD');

    expect(
      await screen.findByRole('heading', { name: 'La sala está llena, ya hay 20 jugadores' }),
    ).toBeVisible();
  });
});

describe('the lobby', () => {
  test('lists members with the crown, "(tú)", online or "ausente" and the score', async () => {
    enterRoom('/ABCD');

    const players = await screen.findByRole('region', { name: 'Jugadores' });
    const list = within(players).getByRole('list');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Cóndor Veloz(tú)hosten línea0 pts');
    expect(rows[1]).toHaveTextContent('Zorro Astutoen línea0 pts');
    expect(rows[2]).toHaveTextContent('Oso Sabioausente0 pts');
    expect(screen.getByText('2 de 3 en línea')).toBeVisible();
  });

  test('recomputes presence every 5 s from the last seen time', async () => {
    const almostGone = member({
      playerId: guest.playerId,
      name: guest.name,
      lastSeenAt: new Date(Date.now() - ONLINE_WINDOW_MS + 3_000).toISOString(),
    });
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'], shouldAdvanceTime: true });
    enterRoom(
      '/ABCD',
      room({ members: [member({ playerId: me.playerId, name: me.name }), almostGone] }),
    );
    expect(await screen.findByText('2 de 2 en línea')).toBeVisible();

    act(() => {
      vi.advanceTimersByTime(PRESENCE_RECOMPUTE_MS);
    });

    expect(screen.getByText('1 de 2 en línea')).toBeVisible();
  });

  test('the host can hand over the crown and kick from the member menu', async () => {
    const { mock } = enterRoom('/ABCD');
    mock.on('POST /api/rooms/ABCD/host', () =>
      Response.json({ room: room({ version: 4, hostId: guest.playerId }) }),
    );
    mock.on('POST /api/rooms/ABCD/kick', () =>
      Response.json({ room: room({ version: 5, hostId: guest.playerId, members: [] }) }),
    );

    expect(screen.queryByRole('button', { name: `Opciones para ${me.name}` })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: `Opciones para ${away.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sacar de la sala' }));
    await waitFor(() => {
      expect(mock.calls.map((call) => call.route)).toContain('POST /api/rooms/ABCD/kick');
    });
    expect(mock.calls.find((call) => call.route.endsWith('/kick'))?.init.body).toBe(
      JSON.stringify({ playerId: away.playerId }),
    );
  });

  test('handing over moves the crown and hides the host menu', async () => {
    const { mock } = enterRoom('/ABCD');
    mock.on('POST /api/rooms/ABCD/host', () =>
      Response.json({ room: room({ version: 4, hostId: guest.playerId }) }),
    );

    fireEvent.click(await screen.findByRole('button', { name: `Opciones para ${guest.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hacer host' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Opciones para/ })).toBeNull();
    });
    expect(screen.getByText('El host elegirá el juego.')).toBeVisible();
  });

  test('a member who is not host gets no member menu', async () => {
    enterRoom('/ABCD', room({ hostId: guest.playerId }));

    expect(await screen.findByText('El host elegirá el juego.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Opciones para/ })).toBeNull();
  });

  test('every game shows as coming soon', async () => {
    enterRoom('/ABCD');

    const games = await screen.findByRole('region', { name: 'Juegos' });
    for (const name of ['Impostor', 'Just One', 'Wavelength']) {
      expect(within(games).getByRole('heading', { name })).toBeVisible();
    }
    expect(within(games).getAllByText('Próximamente')).toHaveLength(3);
  });

  test('leaving asks first, then leaves and goes home', async () => {
    const { router, mock } = enterRoom('/ABCD');
    mock.on('POST /api/rooms/ABCD/leave', () => Response.json({ ok: true }));

    fireEvent.click(await screen.findByRole('button', { name: 'Salir de la sala' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(mock.calls.map((call) => call.route)).not.toContain('POST /api/rooms/ABCD/leave');

    fireEvent.click(screen.getByRole('button', { name: 'Salir de la sala' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: '¿Salir de la sala?' })).getByRole('button', {
        name: 'Sí, salir',
      }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(mock.calls.map((call) => call.route)).toContain('POST /api/rooms/ABCD/leave');
  });
});

describe('invite', () => {
  test('Copiar link copies the room link and says so', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubNavigator('clipboard', { writeText });
    enterRoom('/ABCD');

    fireEvent.click(await screen.findByRole('button', { name: 'Copiar link' }));

    expect(await screen.findByText('¡Link copiado!')).toBeVisible();
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/ABCD`);
  });

  test('Compartir opens the share sheet and ignores a cancel', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('cancelled', 'AbortError')));
    stubNavigator('share', share);
    enterRoom('/ABCD');

    fireEvent.click(await screen.findByRole('button', { name: 'Compartir' }));

    await waitFor(() => {
      expect(share).toHaveBeenCalledWith({
        title: 'Noche de juegos',
        text: '¡Únete a la sala!',
        url: `${window.location.origin}/ABCD`,
      });
    });
    expect(screen.queryByText('No pudimos compartir el link')).toBeNull();
  });

  test('without a share sheet Compartir opens WhatsApp', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    enterRoom('/ABCD');

    fireEvent.click(await screen.findByRole('button', { name: 'Compartir' }));

    expect(open).toHaveBeenCalledWith(
      `https://wa.me/?text=${encodeURIComponent(`¡Únete a la sala! ${window.location.origin}/ABCD`)}`,
      '_blank',
      'noopener',
    );
  });
});

describe('visibility', () => {
  test('hiding sends away as keepalive and showing pings and applies the room', async () => {
    const { mock } = enterRoom('/ABCD');
    mock.on('POST /api/rooms/ABCD/away', () => new Response(null, { status: 204 }));
    mock.on('POST /api/rooms/ABCD/ping', () =>
      Response.json({ room: room({ version: 9, hostId: guest.playerId }) }),
    );
    await screen.findByText('ABCD');

    setVisibility('hidden');
    await waitFor(() => {
      expect(
        mock.calls.find((call) => call.route === 'POST /api/rooms/ABCD/away')?.init,
      ).toMatchObject({ keepalive: true });
    });

    setVisibility('visible');
    expect(await screen.findByText('El host elegirá el juego.')).toBeVisible();
  });

  test('a kicked phone coming back is sent home with a message', async () => {
    const { router, mock } = enterRoom('/ABCD');
    mock.on('POST /api/rooms/ABCD/ping', () =>
      apiError(403, 'NOT_MEMBER', 'No estás en esta sala'),
    );
    await screen.findByText('ABCD');

    setVisibility('visible');

    expect(await screen.findByText('Te sacaron de la sala')).toBeVisible();
    expect(router.state.location.pathname).toBe('/');
  });
});
