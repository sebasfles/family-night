import { type ImpostorPublic, type ImpostorSecret, type RoomSnapshot } from '@family-night/shared';
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
import { impostorMatch, MATCH_ID } from '../../test/impostor-match';

const zorro = member({ playerId: '22222222-2222-4222-8222-222222222222', name: 'Zorro Astuto' });
const oso = member({ playerId: '33333333-3333-4333-8333-333333333333', name: 'Oso Sabio' });
const colibri = member({
  playerId: '44444444-4444-4444-8444-444444444444',
  name: 'Colibrí Risueño',
});
const everyone = [member({ playerId: me.playerId, name: me.name }), zorro, oso, colibri];
const ids = everyone.map((m) => m.playerId);

const civilian: ImpostorSecret = { role: 'CIVILIAN', word: 'Perro', category: 'Animales' };
const impostor: ImpostorSecret = { role: 'IMPOSTOR', clue: 'Mascota', category: null };

const base = `/api/rooms/ABCD/matches/${MATCH_ID}`;

function room(match: ImpostorPublic | null, overrides: Partial<RoomSnapshot> = {}) {
  return snapshot({ members: everyone, currentMatch: match, ...overrides });
}

function play(
  served: RoomSnapshot,
  secret: ImpostorSecret | null = civilian,
  handlers: Record<string, Handler> = {},
) {
  signIn();
  const mock = mockApi({
    'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
    'POST /api/rooms/ABCD/join': () => Response.json({ room: served }),
    'GET /api/rooms/ABCD': () => Response.json({ room: served }),
    [`GET ${base}/me`]: () => Response.json({ secret }),
    'GET /api/words/categories': () => Response.json({ categories: [] }),
    ...handlers,
  });
  return { ...renderApp('/ABCD'), mock };
}

const sent = (mock: ReturnType<typeof mockApi>, route: string): unknown => {
  const body = mock.calls.find((call) => call.route === route)?.init.body;
  return typeof body === 'string' ? JSON.parse(body) : body;
};

describe('navigation', () => {
  test('a room with a running match opens the game, and ending it returns to the lobby', async () => {
    const { router, mock } = play(room(impostorMatch(ids)));
    mock.on(`POST ${base}/abort`, () => Response.json({ room: room(null, { version: 4 }) }));

    expect(await screen.findByRole('heading', { name: 'Ronda 1' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/ABCD/impostor');

    fireEvent.click(screen.getByRole('button', { name: 'Opciones de la partida' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Terminar partida' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Sí, terminar' }),
    );

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/ABCD');
    });
    expect(mock.calls.map((call) => call.route)).toContain(`POST ${base}/abort`);
  });

  test('only the host has the menu to end the match', async () => {
    play(room(impostorMatch(ids), { hostId: zorro.playerId }));

    expect(await screen.findByRole('heading', { name: 'Ronda 1' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Opciones de la partida' })).toBeNull();
  });
});

describe('the card', () => {
  test('starts hidden and a tap shows the word, with a short vibration', async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    play(room(impostorMatch(ids)));

    const card = await screen.findByRole('button', { name: /Toca para ver tu carta/ });
    expect(screen.queryByText('Perro')).toBeNull();

    fireEvent.click(card);
    expect(screen.getByText('Perro')).toBeVisible();
    expect(screen.getByText('Categoría: Animales')).toBeVisible();
    expect(vibrate).toHaveBeenCalledWith(50);

    fireEvent.click(card);
    expect(screen.queryByText('Perro')).toBeNull();
    Reflect.deleteProperty(navigator, 'vibrate');
  });

  test('an impostor reads the clue and no category when it is off', async () => {
    play(room(impostorMatch(ids)), impostor);

    fireEvent.click(await screen.findByRole('button', { name: /Toca para ver tu carta/ }));

    expect(screen.getByText('Eres el impostor')).toBeVisible();
    expect(screen.getByText('Mascota')).toBeVisible();
    expect(screen.queryByText(/Categoría/)).toBeNull();
  });

  test('a spectator gets no card, no secret request and the waiting message', async () => {
    const { mock } = play(room(impostorMatch(ids.slice(1))), null);

    expect(await screen.findByText('Partida en curso, juegas en la siguiente')).toBeVisible();
    expect(screen.getByText('Espectador')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Toca para ver tu carta/ })).toBeNull();
    expect(screen.queryByRole('button', { name: zorro.name })).toBeNull();
    expect(mock.calls.map((call) => call.route)).not.toContain(`GET ${base}/me`);
  });
});

describe('voting', () => {
  test('shows the turn order, who voted and the count, never the targets', async () => {
    play(
      room(
        impostorMatch([oso.playerId, me.playerId, zorro.playerId, colibri.playerId], {
          votedPlayerIds: [zorro.playerId],
        }),
      ),
    );

    expect(await screen.findByText('Votaron 1 de 4')).toBeVisible();
    expect(screen.getByText('Empieza:')).toHaveTextContent(`Empieza: ${oso.name}`);
    const zorroButton = screen.getByRole('button', { name: /Zorro Astuto/ });
    expect(within(zorroButton).getByText('ya votó')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Oso Sabio ya votó/ })).toBeNull();
    expect(screen.queryByRole('button', { name: new RegExp(me.name) })).toBeNull();
  });

  test('a selection is marked at once, sent as provisional, and undone when refused', async () => {
    let answer: (response: Response) => void = () => undefined;
    const match = impostorMatch(ids, { round: 2 });
    const { mock } = play(room(match), civilian, {
      [`PUT ${base}/votes`]: () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });

    await screen.findByRole('heading', { name: 'Ronda 2' });
    fireEvent.click(screen.getByRole('button', { name: /Oso Sabio/ }));

    expect(await screen.findByRole('button', { name: /Oso Sabio tu elección/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(sent(mock, `PUT ${base}/votes`)).toEqual({
      round: 2,
      targetId: oso.playerId,
      confirmed: false,
    });
    expect(screen.getByText('Votaron 0 de 4')).toBeVisible();

    answer(apiError(409, 'STALE_ROUND', 'Esa ronda ya terminó'));
    expect(await screen.findByText('Esa ronda ya terminó')).toBeVisible();
    expect(screen.getByRole('button', { name: /Oso Sabio/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('confirming shows my check and the count before the server answers', async () => {
    const answers: ((response: Response) => void)[] = [];
    const match = impostorMatch(ids);
    const { mock } = play(room(match), civilian, {
      [`PUT ${base}/votes`]: () =>
        new Promise<Response>((resolve) => {
          answers.push(resolve);
        }),
    });

    await screen.findByRole('heading', { name: 'Ronda 1' });
    expect(screen.getByRole('button', { name: 'Confirmar voto' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Oso Sabio/ }));
    await screen.findByRole('button', { name: /Oso Sabio tu elección/ });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar voto' }));

    expect(await screen.findByText('Votaron 1 de 4')).toBeVisible();
    expect(screen.getByText('Votaste por Oso Sabio. Esperando a los demás…')).toBeVisible();
    expect(screen.getByRole('button', { name: /Zorro Astuto/ })).toBeDisabled();
    expect(answers).toHaveLength(1);

    answers[0]?.(Response.json({ room: room(match) }));
    await waitFor(() => {
      expect(answers).toHaveLength(2);
    });
    expect(
      mock.calls.filter((call) => call.route === `PUT ${base}/votes`).map((call) => call.init.body),
    ).toEqual([
      JSON.stringify({ round: 1, targetId: oso.playerId, confirmed: false }),
      JSON.stringify({ round: 1, targetId: oso.playerId, confirmed: true }),
    ]);
    expect(screen.getByText('Votaron 1 de 4')).toBeVisible();

    answers[1]?.(
      Response.json({ room: room({ ...match, votedPlayerIds: [me.playerId] }, { version: 4 }) }),
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Oso Sabio tu voto/ })).toBeDisabled();
    });
    expect(screen.queryByRole('button', { name: 'Confirmar voto' })).toBeNull();
  });

  test('a refused confirmation restores the open vote with the server message', async () => {
    const match = impostorMatch(ids);
    let refuse: (response: Response) => void = () => undefined;
    play(room(match), civilian, {
      [`PUT ${base}/votes`]: (init) =>
        typeof init.body === 'string' && init.body.includes('"confirmed":true')
          ? new Promise<Response>((resolve) => {
              refuse = resolve;
            })
          : Response.json({ room: room(match) }),
    });

    await screen.findByRole('heading', { name: 'Ronda 1' });
    fireEvent.click(screen.getByRole('button', { name: /Oso Sabio/ }));
    await screen.findByRole('button', { name: /Oso Sabio tu elección/ });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar voto' }));
    expect(await screen.findByText('Votaron 1 de 4')).toBeVisible();

    refuse(apiError(409, 'CONFLICT', 'Hubo cambios al mismo tiempo, intenta de nuevo'));

    expect(await screen.findByText('Hubo cambios al mismo tiempo, intenta de nuevo')).toBeVisible();
    expect(screen.getByText('Votaron 0 de 4')).toBeVisible();
    expect(screen.getByRole('button', { name: /Oso Sabio tu elección/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Confirmar voto' })).toBeEnabled();
  });

  test('my confirmed vote stays marked after a reload of the same round', async () => {
    const match = impostorMatch(ids);
    const voted = room({ ...match, votedPlayerIds: [me.playerId] }, { version: 4 });
    play(room(match), civilian, {
      [`PUT ${base}/votes`]: (init) =>
        Response.json({
          room:
            typeof init.body === 'string' && init.body.includes('"confirmed":true')
              ? voted
              : room(match),
        }),
    });
    await screen.findByRole('heading', { name: 'Ronda 1' });
    fireEvent.click(screen.getByRole('button', { name: /Oso Sabio/ }));
    await screen.findByRole('button', { name: /Oso Sabio tu elección/ });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar voto' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Oso Sabio tu voto/ })).toBeDisabled();
    });

    cleanup();
    play(voted);

    await screen.findByRole('heading', { name: 'Ronda 1' });
    expect(screen.getByRole('button', { name: /Oso Sabio/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('tu voto')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Confirmar voto' })).toBeNull();
  });

  test('a stored vote of an earlier round is not shown in the next one', async () => {
    sessionStorage.setItem(
      `family-night.vote.${MATCH_ID}`,
      JSON.stringify({ round: 1, targetId: oso.playerId }),
    );
    play(room(impostorMatch(ids, { round: 2 })));

    await screen.findByRole('heading', { name: 'Ronda 2' });
    expect(screen.getByRole('button', { name: /Oso Sabio/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('an eliminated player keeps the card but cannot vote', async () => {
    play(
      room(
        impostorMatch(ids, {
          round: 2,
          order: ids.filter((id) => id !== me.playerId),
          eliminated: [{ playerId: me.playerId, round: 1, wasImpostor: false, reason: 'VOTE' }],
        }),
      ),
    );

    expect(await screen.findByText('Eliminado')).toBeVisible();
    expect(await screen.findByRole('button', { name: /Toca para ver tu carta/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Zorro Astuto/ })).toBeNull();
    expect(screen.getByText('Votaron 0 de 3')).toBeVisible();
  });

  test('the host confirms before closing with votes unconfirmed, and is told selections count', async () => {
    const match = impostorMatch(ids, { votedPlayerIds: [zorro.playerId, oso.playerId] });
    const { mock } = play(room(match), civilian, {
      [`POST ${base}/close-voting`]: () => Response.json({ room: room(match, { version: 4 }) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar votación' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Faltan 2 por confirmar. Si ya eligieron, su elección cuenta. ¿Cerrar la votación?',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, cerrar' }));

    await waitFor(() => {
      expect(sent(mock, `POST ${base}/close-voting`)).toEqual({ round: 1 });
    });
  });

  test('members see no close button', async () => {
    play(room(impostorMatch(ids), { hostId: zorro.playerId }));
    expect(await screen.findByText('Votaron 0 de 4')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cerrar votación' })).toBeNull();
  });
});

function revealed(
  eliminatedId: string | null,
  options: { wasImpostor?: boolean; tie?: boolean } = {},
): ImpostorPublic {
  const tally = [
    { playerId: zorro.playerId, votes: 2 },
    { playerId: oso.playerId, votes: options.tie ? 2 : 1 },
    { playerId: me.playerId, votes: 0 },
    { playerId: colibri.playerId, votes: 0 },
  ];
  return impostorMatch(ids, {
    phase: 'REVEAL',
    order: ids.filter((id) => id !== eliminatedId),
    votedPlayerIds: ids,
    lastResult: { round: 1, tally, tie: options.tie ?? false, eliminatedId },
    eliminated: eliminatedId
      ? [
          {
            playerId: eliminatedId,
            round: 1,
            wasImpostor: options.wasImpostor ?? false,
            reason: options.tie ? 'TIE_RANDOM' : 'VOTE',
          },
        ]
      : [],
  });
}

describe('the reveal', () => {
  test('ranks the votes and says the eliminated was an impostor', async () => {
    play(room(revealed(zorro.playerId, { wasImpostor: true })));

    expect(
      await screen.findByRole('heading', { name: 'Zorro Astuto fue eliminado' }),
    ).toBeVisible();
    expect(screen.getByText('Era impostor')).toBeVisible();
    const rows = within(screen.getByRole('list', { name: 'Votos' })).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Zorro Astuto2 votos',
      'Oso Sabio1 voto',
      'Cóndor Veloz0 votos',
      'Colibrí Risueño0 votos',
    ]);
    expect(screen.getByRole('button', { name: 'Ver resultado' })).toBeVisible();
  });

  test('a civilian out reads "No era impostor" and the host goes on to the next round', async () => {
    const match = revealed(zorro.playerId);
    const { mock } = play(room(match), civilian, {
      [`POST ${base}/next-round`]: () => Response.json({ room: room(match, { version: 4 }) }),
    });

    expect(await screen.findByText('No era impostor')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente ronda' }));
    await waitFor(() => {
      expect(sent(mock, `POST ${base}/next-round`)).toEqual({ round: 1 });
    });
  });

  test('ties say what the rule did', async () => {
    play(room(revealed(null, { tie: true })));
    expect(
      await screen.findByRole('heading', { name: 'Empate: nadie es eliminado' }),
    ).toBeVisible();
  });

  test('a tie broken by lot says so', async () => {
    play(room(revealed(oso.playerId, { tie: true })));
    expect(
      await screen.findByRole('heading', { name: 'Empate: eliminado por sorteo' }),
    ).toBeVisible();
    expect(screen.getByText('Oso Sabio no era impostor')).toBeVisible();
  });

  test('voting out the last impostor leads straight to the result, with no last chance', async () => {
    const match = revealed(zorro.playerId, { wasImpostor: true });
    const done = finished('CIVILIANS');
    const { mock } = play(room(match), civilian, {
      [`POST ${base}/next-round`]: () => Response.json({ room: room(done, { version: 4 }) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Ver resultado' }));

    expect(await screen.findByRole('heading', { name: 'Ganaron los civiles' })).toBeVisible();
    expect(sent(mock, `POST ${base}/next-round`)).toEqual({ round: 1 });
    expect(screen.queryByText(/adivinar la palabra/)).toBeNull();
  });

  test('members wait for the host', async () => {
    play(room(revealed(zorro.playerId), { hostId: zorro.playerId }));
    expect(await screen.findByText('Esperando al host…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Siguiente ronda' })).toBeNull();
  });
});

function finished(winner: 'CIVILIANS' | 'IMPOSTORS'): ImpostorPublic {
  return {
    ...revealed(zorro.playerId, { wasImpostor: true }),
    status: 'FINISHED',
    phase: 'FINISHED',
    winner,
    reveal: { word: 'Perro', category: 'Animales', impostorIds: [zorro.playerId] },
  };
}

describe('the final screen', () => {
  test('civilians win: the word, the impostor, the history and the points', async () => {
    play(room(finished('CIVILIANS')));

    expect(await screen.findByRole('heading', { name: 'Ganaron los civiles' })).toBeVisible();
    expect(screen.getByText('Perro')).toBeVisible();
    expect(screen.getByText('Ronda 1:')).toBeVisible();
    const points = screen.getByRole('heading', { name: 'Puntos de esta partida' }).parentElement;
    expect(within(points ?? document.body).getAllByText('+1')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Toca para ver tu carta/ })).toBeNull();
  });

  test('points list only the winners still in the room, as the server credits them', async () => {
    const gone = '55555555-5555-4555-8555-555555555555';
    const match = finished('CIVILIANS');
    play(room({ ...match, participants: [...match.participants, gone] }));

    const points = (await screen.findByRole('heading', { name: 'Puntos de esta partida' }))
      .parentElement;
    expect(within(points ?? document.body).getAllByText('+1')).toHaveLength(3);
    expect(screen.queryByText('Alguien que salió')).toBeNull();
  });

  test('impostors win and the impostor gets 2 points', async () => {
    play(room(finished('IMPOSTORS')));

    expect(await screen.findByRole('heading', { name: 'Ganaron los impostores' })).toBeVisible();
    expect(screen.getByText('+2')).toBeVisible();
  });

  test('the host plays again or goes back to the lobby; members wait', async () => {
    const { mock, router } = play(room(finished('CIVILIANS')), civilian, {
      [`POST ${base}/rematch`]: () => Response.json({ room: room(finished('CIVILIANS')) }),
      'POST /api/rooms/ABCD/lobby': () => Response.json({ room: room(null, { version: 9 }) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Jugar otra vez' }));
    await waitFor(() => {
      expect(mock.calls.map((call) => call.route)).toContain(`POST ${base}/rematch`);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Volver al lobby' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/ABCD');
    });
  });

  test('members see "Esperando al host…"', async () => {
    play(room(finished('CIVILIANS'), { hostId: zorro.playerId }));
    expect(await screen.findByText('Esperando al host…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Jugar otra vez' })).toBeNull();
  });
});
