import {
  ONLINE_WINDOW_MS,
  type RoomSnapshot,
  type WavelengthPublic,
  type WavelengthSecret,
} from '@family-night/shared';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import {
  apiError,
  me,
  member,
  mockApi,
  renderApp,
  signIn,
  snapshot,
  type Handler,
} from '../../test/app';
import { stubReducedMotion } from '../../test/motion';
import { spokenText } from '../../test/text';
import { WAVELENGTH_MATCH_ID, wavelengthMatch } from '../../test/wavelength-match';

const zorro = member({ playerId: '22222222-2222-4222-8222-222222222222', name: 'Zorro Astuto' });
const oso = member({ playerId: '33333333-3333-4333-8333-333333333333', name: 'Oso Sabio' });
const colibri = member({
  playerId: '44444444-4444-4444-8444-444444444444',
  name: 'Colibrí Risueño',
});
const self = member({ playerId: me.playerId, name: me.name });
const everyone = [self, zorro, oso, colibri];
const base = `/api/rooms/ABCD/matches/${WAVELENGTH_MATCH_ID}`;

function installFakeAudio() {
  const ticks = { played: 0, resumed: false };
  class FakeAudioContext {
    state: AudioContextState = 'suspended';
    currentTime = 0;
    destination = {};
    resume() {
      return Promise.resolve().then(() => {
        this.state = 'running';
        ticks.resumed = true;
      });
    }
    createOscillator() {
      const node = {
        type: 'sine',
        frequency: { setValueAtTime: () => undefined },
        connect: (next: unknown) => next,
        start: () => {
          ticks.played += 1;
        },
        stop: () => undefined,
      };
      return node;
    }
    createGain() {
      return {
        gain: { setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined },
        connect: (next: unknown) => next,
      };
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return ticks;
}

function room(match: WavelengthPublic | null, overrides: Partial<RoomSnapshot> = {}) {
  return snapshot({ members: everyone, currentMatch: match, ...overrides });
}

function psychicFirst(first: string): string[] {
  return [first, ...everyone.map((m) => m.playerId).filter((id) => id !== first)];
}

function play(
  served: RoomSnapshot,
  secret: WavelengthSecret | null = null,
  handlers: Record<string, Handler> = {},
) {
  signIn();
  const mock = mockApi({
    'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
    'POST /api/rooms/ABCD/join': () => Response.json({ room: served }),
    'GET /api/rooms/ABCD': () => Response.json({ room: served }),
    [`GET ${base}/me`]: () => Response.json({ secret }),
    ...handlers,
  });
  return { ...renderApp('/ABCD'), mock };
}

const sent = (mock: ReturnType<typeof mockApi>, route: string): unknown => {
  const body = mock.calls.findLast((call) => call.route === route)?.init.body;
  return typeof body === 'string' ? JSON.parse(body) : body;
};

const secretCalls = (mock: ReturnType<typeof mockApi>) =>
  mock.calls.filter((call) => call.route === `GET ${base}/me`).length;

describe('navigation', () => {
  test('a running Wavelength match opens its screen, and aborting returns to the lobby', async () => {
    const { router, mock } = play(room(wavelengthMatch(psychicFirst(zorro.playerId))));
    mock.on(`POST ${base}/abort`, () => Response.json({ room: room(null, { version: 4 }) }));

    expect(await screen.findByRole('heading', { name: 'Ronda 1' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/ABCD/wavelength');
    expect(screen.getByText('Psíquico: Zorro Astuto')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la partida' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Terminar partida' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, terminar' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/ABCD');
    });
  });
});

describe('the clue', () => {
  test('the psychic sees the target zone, types a clue of up to 40 characters and sends it', async () => {
    const match = wavelengthMatch(psychicFirst(me.playerId));
    const { mock } = play(room(match), { role: 'PSYCHIC', round: 1, target: 62 });
    let answer: (response: Response) => void = () => undefined;
    mock.on(
      `PUT ${base}/clue`,
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );

    expect(await screen.findByRole('heading', { name: 'Eres el psíquico' })).toBeVisible();
    expect(await screen.findByRole('img', { name: 'El objetivo' })).toBeVisible();
    const input = screen.getByLabelText('Tu pista');
    expect(input).toHaveAttribute('maxLength', '40');
    expect(screen.getByRole('button', { name: 'Dar pista' })).toBeDisabled();

    fireEvent.change(input, { target: { value: '  Sopa  ' } });
    expect(screen.getByText('8/40')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Dar pista' }));

    expect(await screen.findByRole('heading', { name: 'Tu pista' })).toBeVisible();
    expect(screen.getByText('Sopa')).toBeVisible();
    expect(sent(mock, `PUT ${base}/clue`)).toEqual({ round: 1, clue: 'Sopa' });

    answer(
      Response.json({ room: room({ ...match, phase: 'GUESS', clue: 'Sopa' }, { version: 4 }) }),
    );
    await waitFor(() => {
      expect(screen.getByText('Adivinaron 0 de 3')).toBeVisible();
    });
    expect(screen.getByText('Sopa')).toBeVisible();
  });

  test('a refused clue brings the form back with the clue typed and shows the message', async () => {
    const match = wavelengthMatch(psychicFirst(me.playerId));
    const { mock } = play(room(match), { role: 'PSYCHIC', round: 1, target: 62 });
    mock.on(`PUT ${base}/clue`, () => apiError(409, 'STALE_ROUND', 'Esa ronda ya terminó'));

    fireEvent.change(await screen.findByLabelText('Tu pista'), { target: { value: 'Sopa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar pista' }));

    expect(await screen.findByText('Esa ronda ya terminó')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Eres el psíquico' })).toBeVisible();
    expect(screen.getByLabelText('Tu pista')).toHaveValue('Sopa');
    expect(screen.getByRole('button', { name: 'Dar pista' })).toBeEnabled();
  });

  test('others wait without asking for a secret; the host skips an offline psychic', async () => {
    const offline = {
      ...zorro,
      online: false,
      lastSeenAt: new Date(Date.now() - 2 * ONLINE_WINDOW_MS).toISOString(),
    };
    const match = wavelengthMatch(psychicFirst(zorro.playerId));
    const { mock } = play(room(match, { members: [self, offline, oso, colibri] }));
    mock.on(`POST ${base}/skip-psychic`, () =>
      Response.json({
        room: room(
          {
            ...match,
            round: 2,
            turn: 1,
            psychicId: me.playerId,
            skipped: { round: 1, psychicId: zorro.playerId, reason: 'SKIPPED' },
          },
          { version: 4 },
        ),
      }),
    );

    expect(await screen.findByText('Zorro Astuto está pensando la pista…')).toBeVisible();
    expect(secretCalls(mock)).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Saltar turno' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, saltar' }));

    await waitFor(() => {
      expect(sent(mock, `POST ${base}/skip-psychic`)).toEqual({ round: 1 });
    });
    expect(
      await screen.findByText('Zorro Astuto perdió su turno, ahora le toca a Cóndor Veloz'),
    ).toBeVisible();
  });

  test('no Saltar turno while the psychic is online', async () => {
    play(room(wavelengthMatch(psychicFirst(zorro.playerId))));
    expect(await screen.findByText('Zorro Astuto está pensando la pista…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Saltar turno' })).toBeNull();
  });
});

describe('guessing', () => {
  const guessing = (overrides: Partial<WavelengthPublic> = {}) =>
    wavelengthMatch(psychicFirst(zorro.playerId), { phase: 'GUESS', clue: 'Sopa', ...overrides });

  test('the dial moves by drag keys and 1-point buttons, and Confirmar commits it once', async () => {
    const match = guessing();
    const { mock } = play(room(match, { hostId: zorro.playerId }));
    let answer: (response: Response) => void = () => undefined;
    mock.on(
      `PUT ${base}/guess`,
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );

    const dial = await screen.findByRole('slider', { name: 'Tu respuesta' });
    expect(dial).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('La pista de Zorro Astuto')).toBeVisible();
    expect(screen.getByText('Adivinaron 0 de 3')).toBeVisible();

    fireEvent.keyDown(dial, { key: 'ArrowRight' });
    fireEvent.keyDown(dial, { key: 'PageUp' });
    fireEvent.click(screen.getByRole('button', { name: 'Un punto hacia la izquierda' }));
    expect(dial).toHaveAttribute('aria-valuenow', '60');
    fireEvent.keyDown(dial, { key: 'End' });
    fireEvent.keyDown(dial, { key: 'ArrowUp' });
    expect(dial).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('button', { name: 'Un punto hacia la derecha' })).toBeDisabled();
    fireEvent.keyDown(dial, { key: 'Home' });
    fireEvent.click(screen.getByRole('button', { name: 'Un punto hacia la derecha' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Listo. Esperando a los demás…')).toBeVisible();
    expect(screen.getByText('Adivinaron 1 de 3')).toBeVisible();
    expect(sent(mock, `PUT ${base}/guess`)).toEqual({ round: 1, value: 1 });
    answer(
      Response.json({
        room: room(
          { ...match, committedPlayerIds: [me.playerId] },
          { version: 4, hostId: zorro.playerId },
        ),
      }),
    );
    expect(mock.calls.filter((call) => call.route === `PUT ${base}/guess`)).toHaveLength(1);
    fireEvent.keyDown(dial, { key: 'ArrowRight' });
    expect(dial).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('Adivinaron 1 de 3')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cerrar' })).toBeNull();
  });

  test('a refused guess unlocks the dial at the same value with the server message', async () => {
    const match = guessing();
    const { mock } = play(room(match, { hostId: zorro.playerId }));
    mock.on(`PUT ${base}/guess`, () => apiError(409, 'STALE_ROUND', 'Esa ronda ya terminó'));

    const dial = await screen.findByRole('slider', { name: 'Tu respuesta' });
    fireEvent.keyDown(dial, { key: 'PageUp' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Esa ronda ya terminó')).toBeVisible();
    expect(screen.getByText('Adivinaron 0 de 3')).toBeVisible();
    expect(screen.queryByText('Listo. Esperando a los demás…')).toBeNull();
    expect(dial).toHaveAttribute('aria-valuenow', '60');
    expect(dial).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeEnabled();
  });

  test('the dial ticks on each step of my own dial, and muting it holds across reloads', async () => {
    const ticks = installFakeAudio();
    play(room(guessing(), { hostId: zorro.playerId }));

    const dial = await screen.findByRole('slider', { name: 'Tu respuesta' });
    const toggle = screen.getByRole('button', { name: 'Sonido del dial' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(dial, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(ticks.resumed).toBe(true);
    });
    fireEvent.keyDown(dial, { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Un punto hacia la izquierda' }));
    fireEvent.keyDown(dial, { key: 'Home' });
    fireEvent.keyDown(dial, { key: 'Home' });
    expect(ticks.played).toBe(3);

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.keyDown(dial, { key: 'End' });
    expect(ticks.played).toBe(3);

    cleanup();
    play(room(guessing(), { hostId: zorro.playerId }));
    const again = await screen.findByRole('slider', { name: 'Tu respuesta' });
    expect(screen.getByRole('button', { name: 'Sonido del dial' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    fireEvent.keyDown(again, { key: 'ArrowRight' });
    expect(ticks.played).toBe(3);
  });

  test('the host closes early after confirming who is missing', async () => {
    const match = guessing({ committedPlayerIds: [oso.playerId] });
    const { mock } = play(room(match));
    mock.on(`POST ${base}/close-guessing`, () => Response.json({ room: room(match) }));

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Faltan 2 por responder y sumarán 0. ¿Cerrar igual?',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, cerrar' }));

    await waitFor(() => {
      expect(sent(mock, `POST ${base}/close-guessing`)).toEqual({ round: 1 });
    });
  });

  test('the psychic sees the target while waiting, and spectators only watch', async () => {
    play(room(guessing({ psychicId: me.playerId })), { role: 'PSYCHIC', round: 1, target: 30 });
    expect(await screen.findByRole('img', { name: 'El objetivo' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Tu pista' })).toBeVisible();
    expect(screen.queryByRole('slider')).toBeNull();
  });

  test('a player who left or joined late is a spectator', async () => {
    const { mock } = play(
      room(guessing({ departedIds: [me.playerId] }), { hostId: zorro.playerId }),
    );
    expect(await screen.findByText('Espectador')).toBeVisible();
    expect(screen.getByText('Partida en curso, juegas en la siguiente')).toBeVisible();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
    expect(secretCalls(mock)).toBe(0);
  });
});

describe('the secret', () => {
  test('a psychic again in a later round asks for that round’s target', async () => {
    const ids = psychicFirst(me.playerId);
    const first = wavelengthMatch(ids, { phase: 'GUESS', clue: 'Sopa' });
    let round = 1;
    const { mock } = play(room(first), null, {
      [`GET ${base}/me`]: () =>
        Response.json({ secret: { role: 'PSYCHIC', round, target: round * 10 } }),
    });
    mock.on(`POST ${base}/close-guessing`, () =>
      Response.json({
        room: room(
          {
            ...first,
            phase: 'REVEAL',
            lastResult: {
              round: 1,
              psychicId: me.playerId,
              target: 10,
              guesses: [],
              psychicPoints: 0,
            },
          },
          { version: 4 },
        ),
      }),
    );
    mock.on(`POST ${base}/next-round`, () => {
      round = 2;
      return Response.json({
        room: room({ ...first, phase: 'CLUE', clue: null, round: 2, turn: 4 }, { version: 5 }),
      });
    });

    await screen.findByRole('img', { name: 'El objetivo' });
    expect(secretCalls(mock)).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cerrar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Siguiente ronda' }));

    expect(await screen.findByRole('heading', { name: 'Ronda 2' })).toBeVisible();
    await screen.findByRole('img', { name: 'El objetivo' });
    expect(secretCalls(mock)).toBe(2);
  });
});

describe('the reveal and the end', () => {
  const ids = psychicFirst(zorro.playerId);
  const revealed = (overrides: Partial<WavelengthPublic> = {}) =>
    wavelengthMatch(ids, {
      phase: 'REVEAL',
      clue: 'Sopa',
      committedPlayerIds: [me.playerId, oso.playerId],
      lastResult: {
        round: 1,
        psychicId: zorro.playerId,
        target: 62,
        guesses: [
          { playerId: me.playerId, value: 60, points: 4 },
          { playerId: oso.playerId, value: 80, points: 2 },
          { playerId: colibri.playerId, value: null, points: 0 },
        ],
        psychicPoints: 3,
      },
      totals: {
        [me.playerId]: 4,
        [zorro.playerId]: 3,
        [oso.playerId]: 2,
        [colibri.playerId]: 0,
      },
      ...overrides,
    });

  test('the reveal shows the target, every guess with its points and the totals', async () => {
    const { mock } = play(room(revealed()));
    mock.on(`POST ${base}/next-round`, () => Response.json({ room: room(revealed()) }));

    expect(await screen.findByRole('heading', { name: 'El objetivo era 62' })).toBeVisible();
    expect(screen.getByText('Pista de Zorro Astuto: «Sopa»')).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'Objetivo en 62, entre Frío y Caliente' }),
    ).toBeVisible();

    const round = screen.getByRole('list', { name: 'Puntos de la ronda' });
    const rows = within(round).getAllByRole('listitem').map(spokenText);
    expect(rows).toEqual([
      'Zorro Astuto (psíquico)+3',
      'Cóndor Veloz marcó 60+4',
      'Oso Sabio marcó 80+2',
      'Colibrí Risueño no respondió+0',
    ]);
    const totals = screen.getByRole('list', { name: 'Puntaje' });
    expect(within(totals).getAllByRole('listitem').map(spokenText)).toEqual([
      '1Cóndor Veloz(tú)4',
      '2Zorro Astuto3',
      '3Oso Sabio2',
      '4Colibrí Risueño0',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ronda' }));
    await waitFor(() => {
      expect(sent(mock, `POST ${base}/next-round`)).toEqual({ round: 1 });
    });
  });

  test('the target zone turns over in 3D on the dial', async () => {
    stubReducedMotion(false);
    play(room(revealed()));

    await screen.findByRole('heading', { name: 'El objetivo era 62' });
    const bands = () => document.querySelector('[data-layer="bands"]');
    expect(bands()?.querySelector('path[data-points]')).toBeNull();
    await waitFor(() => {
      expect(bands()?.querySelectorAll('path[data-points]')).toHaveLength(3);
    });
    expect(bands()?.querySelector('[data-flip]')).toHaveStyle({ transform: 'rotateY(180deg)' });
  });

  test('players with equal points share a rank', async () => {
    play(
      room(
        revealed({
          totals: {
            [me.playerId]: 4,
            [zorro.playerId]: 2,
            [oso.playerId]: 2,
            [colibri.playerId]: 0,
          },
        }),
      ),
    );

    const totals = await screen.findByRole('list', { name: 'Puntaje' });
    expect(within(totals).getAllByRole('listitem').map(spokenText)).toEqual([
      '1Cóndor Veloz(tú)4',
      '2Zorro Astuto2',
      '2Oso Sabio2',
      '4Colibrí Risueño0',
    ]);
  });

  test('on the last turn the host sees Ver resultado', async () => {
    play(room(revealed({ turn: 3 })));
    expect(await screen.findByRole('button', { name: 'Ver resultado' })).toBeVisible();
  });

  test('members wait for the host after the reveal', async () => {
    play(room(revealed(), { hostId: zorro.playerId }));
    expect(await screen.findByText('Esperando al host…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Siguiente ronda' })).toBeNull();
  });

  test('the final scoreboard crowns the leader and the host plays again or leaves', async () => {
    const finished = revealed({ status: 'FINISHED', phase: 'FINISHED', turn: 3, round: 4 });
    const { mock } = play(room(finished));
    mock.on(`POST ${base}/rematch`, () => Response.json({ room: room(finished) }));

    expect(await screen.findByRole('heading', { name: 'Fin de la partida' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ganó Cóndor Veloz' })).toBeVisible();
    expect(screen.getByText('Wavelength, 4 rondas')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Volver al lobby' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Jugar otra vez' }));
    await waitFor(() => {
      expect(mock.calls.map((call) => call.route)).toContain(`POST ${base}/rematch`);
    });
  });
});
