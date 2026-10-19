import {
  finishManada,
  mergeGroups,
  revealManada,
  type ManadaConfig,
  type ManadaPublic,
  type ManadaSecret,
  type RoomSnapshot,
} from '@family-night/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { me, member, mockApi, renderApp, signIn, snapshot, type Handler } from '../../test/app';
import { MANADA_MATCH_ID, manadaMatch } from '../../test/manada-match';
import { spokenText } from '../../test/text';

const zorro = member({ playerId: '22222222-2222-4222-8222-222222222222', name: 'Zorro Astuto' });
const oso = member({ playerId: '33333333-3333-4333-8333-333333333333', name: 'Oso Sabio' });
const colibri = member({
  playerId: '44444444-4444-4444-8444-444444444444',
  name: 'Colibrí Risueño',
});
const self = member({ playerId: me.playerId, name: me.name });
const everyone = [self, zorro, oso, colibri];
const ids = everyone.map((m) => m.playerId);
const base = `/api/rooms/ABCD/matches/${MANADA_MATCH_ID}`;

function room(match: ManadaPublic | null, overrides: Partial<RoomSnapshot> = {}) {
  return snapshot({ members: everyone, currentMatch: match, selectedGame: 'MANADA', ...overrides });
}

function revealed(answers: string[], overrides: Partial<ManadaPublic> = {}): ManadaPublic {
  const match = manadaMatch(ids, overrides);
  return revealManada(
    { ...match, answeredPlayerIds: ids.slice(0, answers.length) },
    answers.map((answer, index) => ({ playerId: ids[index] ?? '', answer })),
  );
}

function secret(answer: string | null = null): ManadaSecret {
  return { role: 'ANSWERER', round: 1, answer };
}

function play(
  served: RoomSnapshot,
  mine: () => ManadaSecret | null = () => secret(),
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

const groupNamed = (label: string) =>
  screen.getByRole('list', { name: `Respondieron ${label}` }).closest('li') as HTMLElement;

describe('answering', () => {
  test('a running match opens its screen with the question for everyone', async () => {
    const { router } = play(room(manadaMatch(ids)));

    expect(await screen.findByRole('heading', { name: 'Una fruta amarilla' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/ABCD/manada');
    expect(screen.getByText('La manada, 10 rondas')).toBeVisible();
    expect(screen.getByText('Respondieron 0 de 4')).toBeVisible();
  });

  test('a player writes up to 3 words, confirms once and sees the answer kept', async () => {
    const match = manadaMatch(ids);
    let mine = secret();
    const { mock } = play(room(match), () => mine);
    let respond: () => void = () => undefined;
    mock.on(
      `PUT ${base}/answer`,
      () =>
        new Promise<Response>((resolve) => {
          respond = () => {
            mine = secret('Plátano frito');
            resolve(
              Response.json({
                room: room({ ...match, answeredPlayerIds: [me.playerId] }, { version: 4 }),
              }),
            );
          };
        }),
    );

    const input = await screen.findByLabelText('Tu respuesta');
    expect(input).toHaveAttribute('maxLength', '30');
    const confirm = screen.getByRole('button', { name: 'Confirmar respuesta' });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: 'un plátano muy frito' } });
    expect(screen.getByText('Máximo 3 palabras')).toBeVisible();
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: '  Plátano    frito ' } });
    expect(input).toHaveValue('Plátano frito ');
    fireEvent.click(confirm);

    expect(await screen.findByText('Listo. Esperando a los demás…')).toBeVisible();
    expect(screen.getByText('Plátano frito')).toBeVisible();
    expect(screen.getByText('Respondieron 1 de 4')).toBeVisible();
    expect(screen.queryByLabelText('Tu respuesta')).toBeNull();
    expect(sent(mock, `PUT ${base}/answer`)).toEqual({ round: 1, answer: 'Plátano frito' });

    respond();
    await waitFor(() => {
      expect(mock.calls.filter((call) => call.route === `GET ${base}/me`)).toHaveLength(2);
    });
    expect(screen.getByText('Plátano frito')).toBeVisible();
  });

  test('a spectator only watches', async () => {
    play(room(manadaMatch(ids.slice(1))), () => null);

    expect(await screen.findByText('Están respondiendo…')).toBeVisible();
    expect(screen.getByText('Espectador')).toBeVisible();
    expect(screen.queryByLabelText('Tu respuesta')).toBeNull();
  });

  test('the host closes with answers missing after a confirmation', async () => {
    const match = manadaMatch(ids, { answeredPlayerIds: [zorro.playerId, oso.playerId] });
    const { mock } = play(room(match), () => secret(), {
      [`POST ${base}/close-answers`]: () =>
        Response.json({ room: room(revealed(['Mango', 'mango', 'Piña']), { version: 4 }) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar respuestas' }));
    const dialog = screen.getByRole('alertdialog');
    expect(
      within(dialog).getByText('Faltan 2 respuestas y no contarán. ¿Cerrar igual?'),
    ).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sí, cerrar' }));

    expect(await screen.findByText('Suma la manada de «Mango»')).toBeVisible();
    expect(sent(mock, `POST ${base}/close-answers`)).toEqual({ round: 1 });
  });
});

describe('the reveal', () => {
  test('shows the groups with names, who scores, who is left out and the cow moving', async () => {
    play(room(revealed(['Mango', 'mangos', 'Piña']), { hostId: zorro.playerId }));

    expect(await screen.findByText('Suma la manada de «Mango»')).toBeVisible();
    expect(
      within(screen.getByRole('list', { name: 'Respondieron Mango' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([me.name, 'Zorro Astuto']);
    expect(within(groupNamed('Mango')).getByText('+1 cada uno')).toBeVisible();
    expect(screen.getByText('Sin respuesta: Colibrí Risueño')).toBeVisible();
    expect(screen.getByText('La vaca rosa pasa a Oso Sabio')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Elegir el grupo/ })).toBeNull();
    expect(screen.getByText('Esperando al host…')).toBeVisible();
  });

  test('a tie for the largest group scores nobody', async () => {
    play(room(revealed(['Mango', 'mango', 'Piña', 'piña'])));

    expect(await screen.findByText('Empatan las manadas más grandes: nadie suma')).toBeVisible();
    expect(screen.getAllByText('Empate')).toHaveLength(2);
    expect(screen.getByText('Nadie tiene la vaca rosa')).toBeVisible();
  });

  test('the host merges two groups at once and can split them back', async () => {
    const match = revealed(['Mango', 'Plátano', 'Banana', 'Piña']);
    const { mock } = play(room(match), () => null, {
      [`POST ${base}/merge-groups`]: () =>
        Response.json({
          room: room(mergeGroups(match, zorro.playerId, oso.playerId), { version: 4 }),
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Elegir el grupo Plátano' }));
    expect(screen.getByText(/Toca otro grupo para unirlo con «Plátano»/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Elegir el grupo Banana' }));

    expect(await screen.findByText('Suma la manada de «Plátano / Banana»')).toBeVisible();
    expect(within(groupNamed('Plátano / Banana')).getByText('Unidas por el host')).toBeVisible();
    expect(sent(mock, `POST ${base}/merge-groups`)).toEqual({
      round: 1,
      groupIds: [zorro.playerId, oso.playerId],
    });

    mock.on(`POST ${base}/split-group`, () => Response.json({ room: room(match, { version: 5 }) }));
    fireEvent.click(
      within(groupNamed('Plátano / Banana')).getByRole('button', { name: 'Separar' }),
    );
    await waitFor(() => {
      expect(sent(mock, `POST ${base}/split-group`)).toEqual({ round: 1, groupId: zorro.playerId });
    });
  });

  test('the host sees the result button when the goal is reached', async () => {
    const last = revealed(['Mango', 'mango', 'Piña'], { round: 10 });
    const { mock } = play(room(last), () => null, {
      [`POST ${base}/next-round`]: () =>
        Response.json({ room: room(finishManada(last), { version: 4 }) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Ver resultado' }));
    expect(
      await screen.findByRole('heading', { name: 'Empate: Cóndor Veloz, Zorro Astuto' }),
    ).toBeVisible();
    expect(sent(mock, `POST ${base}/next-round`)).toEqual({ round: 10 });
  });
});

describe('the end', () => {
  test('the winner, the cow holder and the night points by podium', async () => {
    const finished = finishManada(
      manadaMatch(ids, {
        totals: { [me.playerId]: 4, [zorro.playerId]: 9, [oso.playerId]: 6, [colibri.playerId]: 1 },
        cowHolderId: zorro.playerId,
      }),
    );
    play(room(finished));

    expect(await screen.findByRole('heading', { name: 'Ganó Oso Sabio' })).toBeVisible();
    expect(screen.getByText('con 6 puntos')).toBeVisible();
    expect(screen.getByText('Zorro Astuto sigue con la vaca rosa')).toBeVisible();
    const rows = within(screen.getByRole('list', { name: 'Puntos de esta partida' })).getAllByRole(
      'listitem',
    );
    expect(rows.map((row) => spokenText(row))).toEqual([
      '1Oso Sabio+4 a la noche6',
      '2Zorro Astuto+3 a la noche9',
      `3${me.name}(tú)+2 a la noche4`,
      '4Colibrí Risueño+1 a la noche1',
    ]);
  });
});

describe('the lobby', () => {
  test('the host picks rounds or until 8 points and starts with 3 online', async () => {
    const lobby = snapshot({
      members: everyone.slice(0, 2),
      selectedGame: 'MANADA',
    });
    const { mock } = play(lobby, () => null, {
      'PUT /api/rooms/ABCD/config': (init) => {
        const { config } = JSON.parse(init.body as string) as { config: ManadaConfig };
        return Response.json({
          room: { ...lobby, version: 4, configs: { ...lobby.configs, MANADA: config } },
        });
      },
    });

    expect(await screen.findByRole('button', { name: 'Falta 1 jugador' })).toBeDisabled();
    expect(screen.getByLabelText('Rondas')).toHaveTextContent('10');
    fireEvent.click(screen.getByRole('button', { name: 'Una ronda más' }));
    await waitFor(() => {
      expect(sent(mock, 'PUT /api/rooms/ABCD/config')).toEqual({
        gameType: 'MANADA',
        config: { goal: 'ROUNDS', rounds: 11 },
      });
    });
    expect(screen.getByLabelText('Rondas')).toHaveTextContent('11');

    fireEvent.click(screen.getByRole('radio', { name: '8 puntos' }));
    expect(
      await screen.findByText('Gana quien llegue primero a 8 puntos sin la vaca rosa.'),
    ).toBeVisible();
    expect(screen.queryByLabelText('Rondas')).toBeNull();
  });
});
