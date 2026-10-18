import {
  ONLINE_WINDOW_MS,
  type JustOnePublic,
  type JustOneSecret,
  type RoomSnapshot,
} from '@family-night/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
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
import { JUST_ONE_MATCH_ID, justOneMatch } from '../../test/justone-match';

const zorro = member({ playerId: '22222222-2222-4222-8222-222222222222', name: 'Zorro Astuto' });
const oso = member({ playerId: '33333333-3333-4333-8333-333333333333', name: 'Oso Sabio' });
const colibri = member({
  playerId: '44444444-4444-4444-8444-444444444444',
  name: 'Colibrí Risueño',
});
const self = member({ playerId: me.playerId, name: me.name });
const everyone = [self, zorro, oso, colibri];
const base = `/api/rooms/ABCD/matches/${JUST_ONE_MATCH_ID}`;

function room(match: JustOnePublic | null, overrides: Partial<RoomSnapshot> = {}) {
  return snapshot({
    members: everyone,
    currentMatch: match,
    selectedGame: 'JUST_ONE',
    ...overrides,
  });
}

function guesserFirst(first: string): string[] {
  return [first, ...everyone.map((m) => m.playerId).filter((id) => id !== first)];
}

function secret(overrides: Partial<JustOneSecret> = {}): JustOneSecret {
  return { role: 'CLUE_GIVER', round: 1, word: 'Palta', clue: null, clues: [], ...overrides };
}

function play(
  served: RoomSnapshot,
  mine: () => JustOneSecret | null = () => null,
  handlers: Record<string, Handler> = {},
) {
  signIn();
  const mock = mockApi({
    'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
    'POST /api/rooms/ABCD/join': () => Response.json({ room: served }),
    'GET /api/rooms/ABCD': () => Response.json({ room: served }),
    [`GET ${base}/me`]: () => Response.json({ secret: mine() }),
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

const reviewClues = [
  { authorId: me.playerId, clue: 'Verde' },
  { authorId: oso.playerId, clue: 'Guacamole' },
  { authorId: colibri.playerId, clue: 'verdes' },
];

describe('navigation', () => {
  test('a running Just One match opens its screen with the guesser named', async () => {
    const { router } = play(room(justOneMatch(guesserFirst(zorro.playerId))), () => secret());

    expect(await screen.findByRole('heading', { name: 'Ronda 1' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/ABCD/justone');
    expect(screen.getByText('Adivina: Zorro Astuto')).toBeVisible();
  });
});

describe('clues', () => {
  test('a clue-giver sees the word, writes one word of up to 30 characters and sends it', async () => {
    const match = justOneMatch(guesserFirst(zorro.playerId));
    let mine = secret();
    const { mock } = play(room(match), () => mine);
    let answer: () => void = () => undefined;
    mock.on(
      `PUT ${base}/clue`,
      () =>
        new Promise<Response>((resolve) => {
          answer = () => {
            mine = secret({ clue: 'Verde' });
            resolve(
              Response.json({
                room: room({ ...match, committedPlayerIds: [me.playerId] }, { version: 4 }),
              }),
            );
          };
        }),
    );

    expect(await screen.findByText('Palta')).toBeVisible();
    const input = screen.getByLabelText('Tu pista');
    expect(input).toHaveAttribute('maxLength', '30');
    expect(screen.getByRole('button', { name: 'Dar pista' })).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Ver de' } });
    expect(input).toHaveValue('Verde');
    expect(screen.getByText('5/30')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Dar pista' }));

    expect(await screen.findByText('Listo. Esperando a los demás…')).toBeVisible();
    expect(screen.getByText('Verde')).toBeVisible();
    expect(screen.getByText('Pistas listas: 1 de 3')).toBeVisible();
    expect(sent(mock, `PUT ${base}/clue`)).toEqual({ round: 1, clue: 'Verde' });

    answer();
    await waitFor(() => {
      expect(secretCalls(mock)).toBe(2);
    });
    expect(screen.getByText('Verde')).toBeVisible();
    expect(screen.getByText('Pistas listas: 1 de 3')).toBeVisible();
  });

  test('a refused clue brings the form back with the clue typed and shows the message', async () => {
    const { mock } = play(room(justOneMatch(guesserFirst(zorro.playerId))), () => secret());
    mock.on(`PUT ${base}/clue`, () => apiError(409, 'STALE_ROUND', 'Esa ronda ya terminó'));

    fireEvent.change(await screen.findByLabelText('Tu pista'), { target: { value: 'Verde' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dar pista' }));

    expect(await screen.findByText('Esa ronda ya terminó')).toBeVisible();
    expect(screen.getByLabelText('Tu pista')).toHaveValue('Verde');
    expect(screen.getByText('Pistas listas: 0 de 3')).toBeVisible();
    expect(screen.queryByText('Listo. Esperando a los demás…')).toBeNull();
  });

  test('the guesser waits without asking for the word; the host closes the clues early', async () => {
    const match = justOneMatch(guesserFirst(me.playerId), { committedPlayerIds: [oso.playerId] });
    const { mock } = play(room(match));
    mock.on(`POST ${base}/close-clues`, () =>
      Response.json({
        room: room(
          { ...match, phase: 'REVIEW', committedPlayerIds: [oso.playerId] },
          { version: 4 },
        ),
      }),
    );

    expect(await screen.findByRole('heading', { name: 'Te toca adivinar' })).toBeVisible();
    expect(screen.getByText('Están escribiendo pistas…')).toBeVisible();
    expect(screen.getByText('Pistas listas: 1 de 3')).toBeVisible();
    expect(screen.queryByLabelText('Tu pista')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar pistas' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Faltan 2 pistas y no contarán. ¿Cerrar igual?',
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, cerrar' }));

    await waitFor(() => {
      expect(sent(mock, `POST ${base}/close-clues`)).toEqual({ round: 1 });
    });
    expect(await screen.findByText('Tus compañeros están revisando las pistas…')).toBeVisible();
    expect(secretCalls(mock)).toBe(0);
  });

  test('the host skips a guesser who is offline, after confirming', async () => {
    const offline = {
      ...zorro,
      online: false,
      lastSeenAt: new Date(Date.now() - 2 * ONLINE_WINDOW_MS).toISOString(),
    };
    const match = justOneMatch(guesserFirst(zorro.playerId));
    const { mock } = play(room(match, { members: [self, offline, oso, colibri] }), () => secret());
    mock.on(`POST ${base}/skip-guesser`, () =>
      Response.json({
        room: room(
          {
            ...match,
            round: 2,
            turn: 1,
            guesserId: me.playerId,
            skipped: { round: 1, guesserId: zorro.playerId, reason: 'SKIPPED' },
          },
          { version: 4, members: [self, offline, oso, colibri] },
        ),
      }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Saltar turno' }));
    fireEvent.click(
      within(
        screen.getByRole('alertdialog', {
          name: 'Zorro Astuto no está en línea. ¿Saltar su turno?',
        }),
      ).getByRole('button', { name: 'Sí, saltar' }),
    );

    await waitFor(() => {
      expect(sent(mock, `POST ${base}/skip-guesser`)).toEqual({ round: 1 });
    });
    expect(
      await screen.findByText('Zorro Astuto perdió su turno, ahora le toca a Cóndor Veloz'),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Saltar turno' })).toBeNull();
  });
});

describe('review', () => {
  const reviewing = justOneMatch(guesserFirst(zorro.playerId), {
    phase: 'REVIEW',
    committedPlayerIds: [me.playerId, oso.playerId, colibri.playerId],
    cancelledAuthorIds: [me.playerId, colibri.playerId],
  });

  test('clue-givers see every clue with the repeated ones crossed out and toggle them', async () => {
    const { mock } = play(room(reviewing, { hostId: oso.playerId }), () =>
      secret({ clue: 'Verde', clues: reviewClues }),
    );
    mock.on(`PUT ${base}/cancel-clue`, () =>
      Response.json({
        room: room({ ...reviewing, cancelledAuthorIds: [me.playerId] }, { version: 4 }),
      }),
    );
    mock.on(`POST ${base}/show-clues`, () =>
      Response.json({
        room: room(
          { ...reviewing, phase: 'GUESS', clues: [{ authorId: oso.playerId, clue: 'Guacamole' }] },
          { version: 5 },
        ),
      }),
    );

    const list = await screen.findByRole('list', { name: 'Pistas' });
    const crossed = within(list).getByRole('button', {
      name: 'verdes, de Colibrí Risueño, tachada',
    });
    expect(crossed).toHaveAttribute('aria-pressed', 'true');
    expect(within(list).getByRole('button', { name: 'Guacamole, de Oso Sabio' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('Queda 1 pista')).toBeVisible();

    fireEvent.click(crossed);
    await waitFor(() => {
      expect(sent(mock, `PUT ${base}/cancel-clue`)).toEqual({
        round: 1,
        authorId: colibri.playerId,
        cancelled: false,
      });
    });
    expect(
      await within(list).findByRole('button', { name: 'verdes, de Colibrí Risueño' }),
    ).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar pistas' }));
    await waitFor(() => {
      expect(sent(mock, `POST ${base}/show-clues`)).toEqual({ round: 1 });
    });
    expect(await screen.findByRole('heading', { name: 'Pistas para Zorro Astuto' })).toBeVisible();
  });

  test('a crossed clue flips at once and a refusal flips it back with the message', async () => {
    const { mock } = play(room(reviewing, { hostId: oso.playerId }), () =>
      secret({ clue: 'Verde', clues: reviewClues }),
    );
    let refuse: () => void = () => undefined;
    mock.on(
      `PUT ${base}/cancel-clue`,
      () =>
        new Promise<Response>((resolve) => {
          refuse = () => {
            resolve(apiError(409, 'STALE_ROUND', 'Esa ronda ya terminó'));
          };
        }),
    );

    const list = await screen.findByRole('list', { name: 'Pistas' });
    fireEvent.click(within(list).getByRole('button', { name: 'Guacamole, de Oso Sabio' }));

    expect(
      await within(list).findByRole('button', { name: 'Guacamole, de Oso Sabio, tachada' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Quedan 0 pistas')).toBeVisible();

    refuse();
    expect(await screen.findByText('Esa ronda ya terminó')).toBeVisible();
    expect(within(list).getByRole('button', { name: 'Guacamole, de Oso Sabio' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('Queda 1 pista')).toBeVisible();
  });

  test('the guesser sees no clue and cannot show them unless they are the host', async () => {
    const asGuesser = { ...reviewing, guesserId: me.playerId };
    const { mock } = play(room(asGuesser, { hostId: zorro.playerId }));

    expect(await screen.findByText('Tus compañeros están revisando las pistas…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mostrar pistas' })).toBeNull();
    expect(screen.queryByText('Guacamole')).toBeNull();
    expect(secretCalls(mock)).toBe(0);
  });

  test('the host who is the guesser can show the clues without seeing them', async () => {
    const asGuesser = { ...reviewing, guesserId: me.playerId };
    play(room(asGuesser));

    expect(await screen.findByRole('button', { name: 'Mostrar pistas' })).toBeEnabled();
    expect(screen.queryByRole('list', { name: 'Pistas' })).toBeNull();
  });
});

describe('guess and reveal', () => {
  const guessing = justOneMatch(guesserFirst(me.playerId), {
    phase: 'GUESS',
    committedPlayerIds: [zorro.playerId, oso.playerId, colibri.playerId],
    cancelledAuthorIds: [zorro.playerId, colibri.playerId],
    clues: [{ authorId: oso.playerId, clue: 'Guacamole' }],
  });

  function revealed(outcome: 'CORRECT' | 'WRONG' | 'PASS', accepted = false): JustOnePublic {
    const score = outcome === 'CORRECT' ? 1 : 0;
    return {
      ...guessing,
      phase: 'REVEAL',
      score,
      roundsWon: score,
      lastResult: {
        round: 1,
        guesserId: me.playerId,
        word: 'Palta',
        guess: outcome === 'PASS' ? null : outcome === 'CORRECT' ? 'palta' : 'Aguacate',
        outcome,
        accepted,
        clues: [
          { authorId: zorro.playerId, clue: 'Verde', cancelled: true },
          { authorId: oso.playerId, clue: 'Guacamole', cancelled: false },
          { authorId: colibri.playerId, clue: 'verdes', cancelled: true },
        ],
        scoreBefore: 0,
        score,
      },
    };
  }

  test('the guesser sees only the surviving clues and guesses', async () => {
    const { mock } = play(room(guessing));
    mock.on(`PUT ${base}/guess`, () =>
      Response.json({ room: room(revealed('WRONG'), { version: 4 }) }),
    );

    const list = await screen.findByRole('list', { name: 'Pistas' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Guacamole']);
    expect(screen.getByRole('button', { name: 'Adivinar' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('¿Cuál es la palabra?'), {
      target: { value: ' Aguacate ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adivinar' }));

    await waitFor(() => {
      expect(sent(mock, `PUT ${base}/guess`)).toEqual({ round: 1, guess: 'Aguacate' });
    });
    expect(await screen.findByRole('heading', { name: 'Palta' })).toBeVisible();
    expect(screen.getByText('Dijiste «Aguacate». No era')).toBeVisible();
    expect(screen.getByText(/^Esta ronda:/)).toHaveTextContent(
      'Esta ronda: −1, el puntaje no baja de 0',
    );
    expect(screen.getByRole('button', { name: 'Contar como acierto' })).toBeVisible();
    expect(secretCalls(mock)).toBe(0);
  });

  test('a guess shows at once what I said, and a refusal brings the form back with it', async () => {
    const { mock } = play(room(guessing));
    let refuse: () => void = () => undefined;
    mock.on(
      `PUT ${base}/guess`,
      () =>
        new Promise<Response>((resolve) => {
          refuse = () => {
            resolve(apiError(409, 'STALE_ROUND', 'Esa ronda ya terminó'));
          };
        }),
    );

    fireEvent.change(await screen.findByLabelText('¿Cuál es la palabra?'), {
      target: { value: 'Aguacate' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Adivinar' }));

    expect(await screen.findByText('Dijiste «Aguacate». Viendo el resultado…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Pasar' })).toBeNull();

    refuse();
    expect(await screen.findByText('Esa ronda ya terminó')).toBeVisible();
    expect(screen.getByLabelText('¿Cuál es la palabra?')).toHaveValue('Aguacate');
  });

  test('the guesser can pass', async () => {
    const { mock } = play(room(guessing));
    mock.on(`PUT ${base}/guess`, () =>
      Response.json({ room: room(revealed('PASS'), { version: 4 }) }),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Pasar' }));

    await waitFor(() => {
      expect(sent(mock, `PUT ${base}/guess`)).toEqual({ round: 1, guess: null });
    });
    expect(await screen.findByText('Pasaste')).toBeVisible();
    expect(screen.getByText(/^Esta ronda:/)).toHaveTextContent('Esta ronda: 0');
    expect(screen.queryByRole('button', { name: 'Contar como acierto' })).toBeNull();
  });

  test('others see the clues while the guesser thinks', async () => {
    play(room({ ...guessing, guesserId: zorro.playerId }), () => secret({ clues: reviewClues }));

    expect(await screen.findByText('Zorro Astuto está adivinando…')).toBeVisible();
    expect(screen.getByText('Guacamole')).toBeVisible();
    expect(screen.queryByLabelText('¿Cuál es la palabra?')).toBeNull();
  });

  test('the host counts a wrong guess as correct', async () => {
    const wrong = revealed('WRONG');
    const { mock } = play(room(wrong));
    mock.on(`POST ${base}/accept-guess`, () =>
      Response.json({
        room: room(
          {
            ...wrong,
            score: 1,
            roundsWon: 1,
            lastResult: wrong.lastResult && {
              ...wrong.lastResult,
              outcome: 'CORRECT',
              accepted: true,
              score: 1,
            },
          },
          { version: 5 },
        ),
      }),
    );

    expect(await screen.findByText('Puntaje del equipo:')).toBeVisible();
    const crossed = within(screen.getByRole('list', { name: 'Pistas de la ronda' })).getAllByText(
      'Tachada',
    );
    expect(crossed).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Contar como acierto' }));

    await waitFor(() => {
      expect(sent(mock, `POST ${base}/accept-guess`)).toEqual({ round: 1 });
    });
    expect(await screen.findByText('Dijiste «Aguacate», cuenta como acierto')).toBeVisible();
    expect(screen.getByText(/^Esta ronda:/)).toHaveTextContent('Esta ronda: +1');
    expect(screen.queryByRole('button', { name: 'Contar como acierto' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Siguiente ronda' })).toBeVisible();
  });

  test('members wait for the host, and the last round leads to the result', async () => {
    play(room({ ...revealed('CORRECT'), turn: 3 }, { hostId: zorro.playerId }));

    expect(await screen.findByText('¡Acertaste!')).toBeVisible();
    expect(screen.getByText('Esperando al host…')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Contar como acierto' })).toBeNull();
  });

  test('others read the verdict about the guesser by name', async () => {
    const wrong = revealed('WRONG');
    const result = wrong.lastResult;
    if (!result) throw new Error('missing result');
    play(
      room({
        ...wrong,
        guesserId: zorro.playerId,
        score: 1,
        lastResult: { ...result, guesserId: zorro.playerId, scoreBefore: 2, score: 1 },
      }),
    );

    expect(await screen.findByText('Zorro Astuto dijo «Aguacate». No era')).toBeVisible();
    expect(screen.getByText(/^Esta ronda:/)).toHaveTextContent('Esta ronda: −1');
    expect(screen.getByText(/^Puntaje del equipo:/)).toHaveTextContent('Puntaje del equipo: 1');
  });

  test('the final screen shows the team score and the rounds won', async () => {
    const finished = {
      ...revealed('CORRECT'),
      status: 'FINISHED',
      phase: 'FINISHED',
      score: 3,
      roundsWon: 4,
    } as const;
    play(room(finished));

    expect(await screen.findByRole('heading', { name: '3' })).toBeVisible();
    expect(screen.getByText('Acertaron 4 rondas')).toBeVisible();
    expect(screen.getByText('Cada jugador suma 3 puntos al marcador de la noche.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Jugar otra vez' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Volver al lobby' })).toBeVisible();
  });
});

describe('spectators', () => {
  test('a player who left watches as Espectador and is never sent the word', async () => {
    const { mock } = play(
      room(justOneMatch(guesserFirst(zorro.playerId), { departedIds: [me.playerId] }), {
        hostId: zorro.playerId,
      }),
      () => secret(),
    );

    expect(await screen.findByText('Espectador')).toBeVisible();
    expect(screen.getByText('Partida en curso, juegas en la siguiente')).toBeVisible();
    expect(screen.queryByLabelText('Tu pista')).toBeNull();
    expect(secretCalls(mock)).toBe(0);
  });
});
