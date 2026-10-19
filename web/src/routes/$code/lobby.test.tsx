import { ONLINE_WINDOW_MS, PRESENCE_RECOMPUTE_MS, type RoomSnapshot } from '@family-night/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { apiError, me, member, mockApi, renderApp, signIn, snapshot } from '../../test/app';
import { loadIdentity } from '../../identity/storage';
import { impostorMatch } from '../../test/impostor-match';

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

const players = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    index === 0
      ? member({ playerId: me.playerId, name: me.name })
      : member({
          playerId: `${String(index + 1).repeat(8)}-0000-4000-8000-000000000000`,
          name: `Jugador ${String(index + 1)}`,
        }),
  );

const body = (mock: ReturnType<typeof mockApi>, route: string): unknown => {
  const sent = mock.calls.findLast((call) => call.route === route)?.init.body;
  return typeof sent === 'string' ? JSON.parse(sent) : undefined;
};

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
    expect(screen.getByText('Esperando a que el host inicie…')).toBeVisible();
  });

  test('handing over and kicking show at once and a refusal restores the room', async () => {
    const { mock } = enterRoom('/ABCD');
    let answer: (response: Response) => void = () => undefined;
    const deferred = () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      });
    mock.on('POST /api/rooms/ABCD/kick', deferred);

    fireEvent.click(await screen.findByRole('button', { name: `Opciones para ${away.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sacar de la sala' }));
    const awayMenu = { name: `Opciones para ${away.name}` };
    await waitFor(() => {
      expect(screen.queryByRole('button', awayMenu)).toBeNull();
    });
    expect(screen.getByText('2 de 2 en línea')).toBeVisible();
    answer(apiError(409, 'TARGET_NOT_MEMBER', 'Esa persona ya no está en la sala'));
    expect(await screen.findByText('Esa persona ya no está en la sala')).toBeVisible();
    expect(screen.getByRole('button', awayMenu)).toBeVisible();
    expect(screen.getByText('2 de 3 en línea')).toBeVisible();

    mock.on('POST /api/rooms/ABCD/host', deferred);
    fireEvent.click(screen.getByRole('button', { name: `Opciones para ${guest.name}` }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Hacer host' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Opciones para/ })).toBeNull();
    });
    answer(apiError(403, 'NOT_HOST', 'Solo el host puede hacer eso'));
    expect(await screen.findByText('Solo el host puede hacer eso')).toBeVisible();
    expect(screen.getByRole('button', { name: `Opciones para ${guest.name}` })).toBeVisible();
  });

  test('picking a game marks it chosen before the server answers', async () => {
    const { mock } = enterRoom('/ABCD');
    let answer: (response: Response) => void = () => undefined;
    mock.on(
      'PUT /api/rooms/ABCD/config',
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Jugar Just One' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jugar Just One' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(body(mock, 'PUT /api/rooms/ABCD/config')).toEqual({
      gameType: 'JUST_ONE',
      config: { cycles: 1 },
    });
    answer(Response.json({ room: room({ version: 4, selectedGame: 'JUST_ONE' }) }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jugar Just One' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  test('a member who is not host gets no member menu', async () => {
    enterRoom('/ABCD', room({ hostId: guest.playerId }));

    expect(await screen.findByText('Esperando a que el host inicie…')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Opciones para/ })).toBeNull();
  });

  test('Impostor is chosen by default and every other game can be picked', async () => {
    enterRoom('/ABCD');

    const games = await screen.findByRole('region', { name: 'Juegos' });
    for (const name of ['Impostor', 'Just One', 'Wavelength']) {
      expect(within(games).getByRole('heading', { name })).toBeVisible();
    }
    expect(within(games).getByText('Elegido')).toBeVisible();
    expect(within(games).getByRole('button', { name: 'Jugar Impostor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const name of ['Jugar Wavelength', 'Jugar Just One']) {
      expect(within(games).getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
    }
    expect(within(games).queryByText('Próximamente')).toBeNull();
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
    expect(
      mock.calls.find((call) => call.route === 'POST /api/rooms/ABCD/away')?.init,
    ).toMatchObject({ keepalive: true });

    setVisibility('visible');
    expect(await screen.findByText('Esperando a que el host inicie…')).toBeVisible();
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

describe('the Impostor panel', () => {
  const categories = [
    { id: 'animales', name: 'Animales', count: 25 },
    { id: 'comida', name: 'Comida', count: 25 },
  ];

  function lobby(served: RoomSnapshot) {
    const entered = enterRoom('/ABCD', served);
    entered.mock.on('GET /api/words/categories', () => Response.json({ categories }));
    return entered;
  }

  test('with fewer than 3 online the host cannot start', async () => {
    lobby(room());

    expect(await screen.findByRole('button', { name: 'Faltan 1 jugador' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Juegan 2' })).toBeVisible();
  });

  test('the host starts with the shown config and every phone moves to the game', async () => {
    const served = room({ members: players(3) });
    const { mock, router } = lobby(served);
    mock.on('POST /api/rooms/ABCD/matches', () =>
      Response.json(
        {
          room: {
            ...served,
            version: 9,
            currentMatch: impostorMatch(served.members.map((m) => m.playerId)),
          },
        },
        { status: 201 },
      ),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/ABCD/impostor');
    });
    expect(body(mock, 'POST /api/rooms/ABCD/matches')).toEqual({
      gameType: 'IMPOSTOR',
      config: served.configs.IMPOSTOR,
    });
  });

  test('the impostor stepper is capped by the online players', async () => {
    const { mock } = lobby(room({ members: players(6) }));
    mock.on('PUT /api/rooms/ABCD/config', () =>
      Response.json({ room: room({ members: players(6) }) }),
    );

    expect(await screen.findByText('Hasta 2 con 6 jugadores')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Un impostor más' }));

    await waitFor(() => {
      expect(body(mock, 'PUT /api/rooms/ABCD/config')).toMatchObject({
        gameType: 'IMPOSTOR',
        config: { impostorCount: 2 },
      });
    });
  });

  test('with 3 players one impostor is the most', async () => {
    lobby(room({ members: players(3) }));
    expect(await screen.findByText('Hasta 1 con 3 jugadores')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Un impostor más' })).toBeDisabled();
  });

  test('the host changes a setting and a category; the last category cannot go', async () => {
    const served = room({ members: players(3) });
    const { mock } = lobby(served);
    mock.on('PUT /api/rooms/ABCD/config', () => Response.json({ room: served }));

    fireEvent.click(await screen.findByRole('switch', { name: /Orden aleatorio/ }));
    await waitFor(() => {
      expect(body(mock, 'PUT /api/rooms/ABCD/config')).toMatchObject({
        config: { randomOrder: false },
      });
    });

    expect(await screen.findByRole('button', { name: 'Animales' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Comida' }));
    await waitFor(() => {
      expect(body(mock, 'PUT /api/rooms/ABCD/config')).toMatchObject({
        config: { categories: ['animales', 'comida'] },
      });
    });
  });

  test('members see the config read-only and wait for the host', async () => {
    lobby(room({ members: players(3), hostId: `${'2'.repeat(8)}-0000-4000-8000-000000000000` }));

    expect(await screen.findByText('Esperando a que el host inicie…')).toBeVisible();
    expect(screen.getByText('Solo el host puede cambiarla.')).toBeVisible();
    expect(screen.getByRole('switch', { name: /Orden aleatorio/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Iniciar' })).toBeNull();
  });

  test('a refused start shows the server message', async () => {
    const { mock } = lobby(room({ members: players(3) }));
    mock.on('POST /api/rooms/ABCD/matches', () =>
      apiError(422, 'INVALID_CONFIG', 'Con 3 jugadores puede haber como máximo 1 impostor'),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar' }));

    expect(
      await screen.findByText('Con 3 jugadores puede haber como máximo 1 impostor'),
    ).toBeVisible();
  });
});

describe('the Wavelength panel', () => {
  const wavelengthRoom = (overrides: Partial<RoomSnapshot> = {}) =>
    room({ members: players(3), selectedGame: 'WAVELENGTH', ...overrides });

  test('the host picks Wavelength and every member sees it with its config', async () => {
    const served = room({ members: players(3) });
    const { mock } = enterRoom('/ABCD', served);
    mock.on('GET /api/words/categories', () => Response.json({ categories: [] }));
    mock.on('PUT /api/rooms/ABCD/config', () =>
      Response.json({ room: { ...served, version: 9, selectedGame: 'WAVELENGTH' } }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Jugar Wavelength' }));

    await waitFor(() => {
      expect(body(mock, 'PUT /api/rooms/ABCD/config')).toEqual({
        gameType: 'WAVELENGTH',
        config: { cycles: 1 },
      });
    });
    expect(await screen.findByRole('radio', { name: '1' })).toBeChecked();
    expect(
      screen.getByText(/Cada jugador es psíquico una vez: 3 rondas con 3 en línea/),
    ).toBeVisible();
  });

  test('the host changes the cycles and starts with them', async () => {
    const served = wavelengthRoom({ configs: { ...room().configs, WAVELENGTH: { cycles: 2 } } });
    const { mock } = enterRoom('/ABCD', served);
    mock.on('PUT /api/rooms/ABCD/config', () => Response.json({ room: served }));
    mock.on('POST /api/rooms/ABCD/matches', () =>
      apiError(422, 'NOT_ENOUGH_PLAYERS', 'Se necesitan al menos 3 jugadores en línea'),
    );

    expect(await screen.findByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByText(/psíquico 2 veces: 6 rondas/)).toBeVisible();
    fireEvent.click(screen.getByRole('radio', { name: '3' }));
    await waitFor(() => {
      expect(body(mock, 'PUT /api/rooms/ABCD/config')).toEqual({
        gameType: 'WAVELENGTH',
        config: { cycles: 3 },
      });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    await waitFor(() => {
      expect(body(mock, 'POST /api/rooms/ABCD/matches')).toEqual({
        gameType: 'WAVELENGTH',
        config: { cycles: 2 },
      });
    });
    expect(await screen.findByText('Se necesitan al menos 3 jugadores en línea')).toBeVisible();
  });

  test('members see the chosen game and its config read-only', async () => {
    enterRoom('/ABCD', wavelengthRoom({ hostId: guest.playerId }));

    const games = await screen.findByRole('region', { name: 'Juegos' });
    expect(within(games).queryByRole('button')).toBeNull();
    expect(within(games).getByText('Elegido').closest('li')).toHaveTextContent('Wavelength');
    expect(screen.getByText('Solo el host puede cambiarla.')).toBeVisible();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getByText('Esperando a que el host inicie…')).toBeVisible();
  });
});

describe('the Just One panel', () => {
  test('the host picks Just One, sets the cycles and starts with them', async () => {
    const served = room({ members: players(3) });
    const chosen = { ...served, version: 9, selectedGame: 'JUST_ONE' as const };
    const three = {
      ...chosen,
      version: 10,
      configs: { ...chosen.configs, JUST_ONE: { cycles: 3 } },
    };
    const { mock } = enterRoom('/ABCD', served);
    mock.on('GET /api/words/categories', () => Response.json({ categories: [] }));
    mock.on('PUT /api/rooms/ABCD/config', () => Response.json({ room: chosen }));
    mock.on('POST /api/rooms/ABCD/matches', () =>
      apiError(422, 'NOT_ENOUGH_PLAYERS', 'Se necesitan al menos 3 jugadores en línea'),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Jugar Just One' }));
    await waitFor(() => {
      expect(body(mock, 'PUT /api/rooms/ABCD/config')).toEqual({
        gameType: 'JUST_ONE',
        config: { cycles: 1 },
      });
    });
    expect(
      await screen.findByText(/Cada jugador adivina una vez: 3 rondas con 3 en línea/),
    ).toBeVisible();

    mock.on('PUT /api/rooms/ABCD/config', () => Response.json({ room: three }));
    fireEvent.click(screen.getByRole('radio', { name: '3' }));
    await waitFor(() => {
      expect(body(mock, 'PUT /api/rooms/ABCD/config')).toEqual({
        gameType: 'JUST_ONE',
        config: { cycles: 3 },
      });
    });
    expect(await screen.findByText(/adivina 3 veces: 9 rondas/)).toBeVisible();
    expect(screen.getByRole('radio', { name: '3' })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
    await waitFor(() => {
      expect(body(mock, 'POST /api/rooms/ABCD/matches')).toEqual({
        gameType: 'JUST_ONE',
        config: { cycles: 3 },
      });
    });
  });
});

describe('my name', () => {
  test('I rename myself from the lobby; it shows at once and the device keeps it', async () => {
    const { mock, queryClient } = enterRoom('/ABCD');
    let answer: (response: Response) => void = () => undefined;
    mock.on(
      'PATCH /api/players/me',
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar tu nombre' }));
    const dialog = screen.getByRole('dialog', { name: 'Tu nombre' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: '  Tía   Marta ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Tía')).toBeVisible();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(body(mock, 'PATCH /api/players/me')).toEqual({ name: 'Tía Marta', roomCode: 'ABCD' });
    });

    const renamed = room({
      version: 4,
      members: [member({ playerId: me.playerId, name: 'Tía Marta' }), guest, away],
    });
    answer(Response.json({ player: { playerId: me.playerId, name: 'Tía Marta' }, room: renamed }));
    await waitFor(() => {
      expect(loadIdentity()?.name).toBe('Tía Marta');
    });
    expect(queryClient.getQueryData(['identity'])).toMatchObject({ name: 'Tía Marta' });
    expect(screen.getByText('Marta')).toBeVisible();
  });

  test('a name taken elsewhere brings my old name back with the server message', async () => {
    const { mock } = enterRoom('/ABCD');
    mock.on('PATCH /api/players/me', () =>
      apiError(409, 'NAME_TAKEN', 'Ese nombre ya lo tiene otra persona'),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar tu nombre' }));
    const dialog = screen.getByRole('dialog', { name: 'Tu nombre' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Tía Marta' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Ese nombre ya lo tiene otra persona')).toBeVisible();
    expect(screen.getByText('Veloz')).toBeVisible();
    expect(screen.queryByText('Marta')).toBeNull();
    expect(loadIdentity()?.name).toBe(me.name);
  });

  test('the dialog refuses a name too short, too long or used in the room, and sends nothing', async () => {
    const { mock } = enterRoom('/ABCD');

    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar tu nombre' }));
    const dialog = screen.getByRole('dialog', { name: 'Tu nombre' });
    const input = within(dialog).getByRole('textbox');
    const save = within(dialog).getByRole('button', { name: 'Guardar' });

    fireEvent.change(input, { target: { value: ' A ' } });
    expect(save).toBeDisabled();
    expect(within(dialog).getByText('Entre 2 y 20 caracteres visibles')).toBeVisible();
    fireEvent.change(input, { target: { value: 'a'.repeat(21) } });
    expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: 'zorro ástuto' } });
    expect(save).toBeDisabled();
    expect(within(dialog).getByText('Alguien de la sala ya se llama así')).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mock.calls.map((call) => call.route)).not.toContain('PATCH /api/players/me');
  });

  test('only my own row has the rename button', async () => {
    enterRoom('/ABCD');
    expect(await screen.findAllByRole('button', { name: 'Cambiar tu nombre' })).toHaveLength(1);
  });
});
