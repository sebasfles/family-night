import {
  ONLINE_WINDOW_MS,
  type ImpostorPublic,
  type ImpostorSecret,
  type RoomSnapshot,
} from '@family-night/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { me, member, mockApi, renderApp, signIn, snapshot, type Handler } from '../../test/app';
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

  test('a vote is sent with the round and marked only when the server answers', async () => {
    let answer: (response: Response) => void = () => undefined;
    const match = impostorMatch(ids, { round: 2 });
    const { mock } = play(room(match), civilian, {
      [`PUT ${base}/votes`]: () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });

    await screen.findByRole('heading', { name: 'Ronda 2' });
    const target = screen.getByRole('button', { name: /Oso Sabio/ });
    fireEvent.click(target);

    await waitFor(() => {
      expect(mock.calls.map((call) => call.route)).toContain(`PUT ${base}/votes`);
    });
    expect(sent(mock, `PUT ${base}/votes`)).toEqual({ round: 2, targetId: oso.playerId });
    expect(target).toHaveAttribute('aria-pressed', 'false');

    answer(
      Response.json({
        room: room({ ...match, votedPlayerIds: [me.playerId] }, { version: 4 }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Oso Sabio/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    expect(screen.getByText('Votaron 1 de 4')).toBeVisible();
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

  test('the host confirms before closing with votes missing', async () => {
    const match = impostorMatch(ids, { votedPlayerIds: [zorro.playerId, oso.playerId] });
    const { mock } = play(room(match), civilian, {
      [`POST ${base}/close-voting`]: () => Response.json({ room: room(match, { version: 4 }) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar votación' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Faltan 2 votos. ¿Cerrar la votación igual?',
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
  options: { wasImpostor?: boolean; tie?: boolean; lastGuess?: boolean } = {},
): ImpostorPublic {
  const tally = [
    { playerId: zorro.playerId, votes: 2 },
    { playerId: oso.playerId, votes: options.tie ? 2 : 1 },
    { playerId: me.playerId, votes: 0 },
    { playerId: colibri.playerId, votes: 0 },
  ];
  return impostorMatch(
    ids,
    {
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
    },
    { impostorLastGuess: options.lastGuess ?? true },
  );
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
    expect(screen.getByRole('button', { name: 'Última oportunidad' })).toBeVisible();
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
  });

  test('a vote that ends the match leads to the result', async () => {
    play(room(revealed(zorro.playerId, { wasImpostor: true, lastGuess: false })));
    expect(await screen.findByRole('button', { name: 'Ver resultado' })).toBeVisible();
  });

  test('members wait for the host', async () => {
    play(room(revealed(zorro.playerId), { hostId: zorro.playerId }));
    expect(await screen.findByText('Esperando al host…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Siguiente ronda' })).toBeNull();
  });
});

function guessing(guesserId: string): ImpostorPublic {
  return {
    ...revealed(guesserId, { wasImpostor: true }),
    phase: 'IMPOSTOR_GUESS',
    guess: {
      guesserId,
      options: ['Gato', 'Perro', 'Loro', 'Vaca', 'Pato'],
      chosen: null,
      correct: null,
    },
  };
}

describe('the last chance', () => {
  test('the caught impostor picks one of five words', async () => {
    const { mock } = play(room(guessing(me.playerId)), impostor, {
      [`POST ${base}/guess`]: () => Response.json({ room: room(guessing(me.playerId)) }),
    });

    expect(await screen.findByRole('heading', { name: '¡Te atraparon!' })).toBeVisible();
    for (const option of ['Gato', 'Perro', 'Loro', 'Vaca', 'Pato']) {
      expect(screen.getByRole('button', { name: option })).toBeVisible();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Loro' }));
    await waitFor(() => {
      expect(sent(mock, `POST ${base}/guess`)).toEqual({ option: 'Loro' });
    });
  });

  test('the rest wait, and an online guesser cannot be skipped', async () => {
    play(room(guessing(zorro.playerId)));

    expect(
      await screen.findByText('Zorro Astuto está intentando adivinar la palabra…'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Saltar' })).toBeNull();
  });

  test('the host skips a guesser who is offline', async () => {
    const offline = {
      ...zorro,
      online: false,
      lastSeenAt: new Date(Date.now() - 2 * ONLINE_WINDOW_MS).toISOString(),
    };
    const { mock } = play(
      room(guessing(zorro.playerId), { members: [everyone[0] ?? zorro, offline, oso, colibri] }),
      civilian,
      {
        [`POST ${base}/skip-guess`]: () => Response.json({ room: room(guessing(zorro.playerId)) }),
      },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Saltar' }));
    await waitFor(() => {
      expect(mock.calls.map((call) => call.route)).toContain(`POST ${base}/skip-guess`);
    });
  });
});

function finished(winner: 'CIVILIANS' | 'IMPOSTORS', correct: boolean | null): ImpostorPublic {
  const match = guessing(zorro.playerId);
  return {
    ...match,
    status: 'FINISHED',
    phase: 'FINISHED',
    winner,
    guess: match.guess && {
      ...match.guess,
      chosen: correct === null ? null : correct ? 'Perro' : 'Gato',
      correct,
    },
    reveal: { word: 'Perro', category: 'Animales', impostorIds: [zorro.playerId] },
  };
}

describe('the final screen', () => {
  test('civilians win: the word, the impostor, the history and the points', async () => {
    play(room(finished('CIVILIANS', false)));

    expect(await screen.findByRole('heading', { name: 'Ganaron los civiles' })).toBeVisible();
    expect(screen.getByText('Zorro Astuto dijo «Gato» y falló')).toBeVisible();
    expect(screen.getByText('Perro')).toBeVisible();
    expect(screen.getByText('Ronda 1:')).toBeVisible();
    const points = screen.getByRole('heading', { name: 'Puntos de esta partida' }).parentElement;
    expect(within(points ?? document.body).getAllByText('+1')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Toca para ver tu carta/ })).toBeNull();
  });

  test('a right guess steals the win and the impostor gets 2 points', async () => {
    play(room(finished('IMPOSTORS', true)));

    expect(await screen.findByRole('heading', { name: 'Ganaron los impostores' })).toBeVisible();
    expect(screen.getByText('¡Robó la victoria!')).toBeVisible();
    expect(screen.getByText('+2')).toBeVisible();
  });

  test('the host plays again or goes back to the lobby; members wait', async () => {
    const { mock, router } = play(room(finished('CIVILIANS', null)), civilian, {
      [`POST ${base}/rematch`]: () => Response.json({ room: room(finished('CIVILIANS', null)) }),
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
    play(room(finished('CIVILIANS', null), { hostId: zorro.playerId }));
    expect(await screen.findByText('Esperando al host…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Jugar otra vez' })).toBeNull();
  });
});
