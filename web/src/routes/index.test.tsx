import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { loadIdentity } from '../identity/storage';
import { apiError, me, mockApi, renderApp, signIn, snapshot, type ApiMock } from '../test/app';

const meOk = () => Response.json({ playerId: me.playerId, name: me.name });

test('a first visit greets the new player by name', async () => {
  mockApi({ 'POST /api/players': () => Response.json(me) });

  renderApp('/');

  expect(await screen.findByText('Cóndor Veloz')).toBeVisible();
  expect(screen.getByText(/Hola,/)).toHaveTextContent('Hola, Cóndor Veloz');
});

test('the server being down shows a retry instead of a new identity', async () => {
  signIn();
  const mock = mockApi({
    'GET /api/players/me': () => apiError(500, 'INTERNAL_ERROR', 'Algo salió mal'),
  });

  renderApp('/');

  expect(
    await screen.findByRole(
      'heading',
      { name: 'No pudimos conectar con el servidor' },
      { timeout: 5_000 },
    ),
  ).toBeVisible();
  expect(mock.calls.some((call) => call.route === 'POST /api/players')).toBe(false);
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
});

test('Crear sala opens the new room as its host', async () => {
  signIn();
  const room = snapshot({ roomCode: 'QRST' });
  mockApi({
    'GET /api/players/me': meOk,
    'POST /api/rooms': () => Response.json({ room }, { status: 201 }),
    'POST /api/rooms/QRST/join': () => Response.json({ room }),
  });
  const { router } = renderApp('/');

  fireEvent.click(await screen.findByRole('button', { name: 'Crear sala' }));

  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/QRST');
  });
  expect(await screen.findByText('QRST')).toBeVisible();
});

test('the code field uppercases, keeps four letters and enables Unirme only for a valid code', async () => {
  signIn();
  mockApi({ 'GET /api/players/me': meOk });
  const { router } = renderApp('/');
  const input = await screen.findByLabelText('Código de sala');
  const join = screen.getByRole('button', { name: 'Unirme' });

  fireEvent.change(input, { target: { value: 'ab1' } });
  expect(input).toHaveValue('AB');
  expect(join).toBeDisabled();

  fireEvent.change(input, { target: { value: 'abcl' } });
  expect(join).toBeDisabled();

  fireEvent.change(input, { target: { value: 'abcdef' } });
  expect(input).toHaveValue('ABCD');
  expect(join).toBeEnabled();

  fireEvent.click(join);
  await waitFor(() => {
    expect(router.state.location.pathname).toBe('/ABCD');
  });
});

describe('renaming from home', () => {
  function deferRename(mock: ApiMock) {
    let answer: (response: Response) => void = () => undefined;
    mock.on(
      'PATCH /api/players/me',
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    return (response: Response) => {
      answer(response);
    };
  }

  async function saveName(name: string) {
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar tu nombre' }));
    const dialog = screen.getByRole('dialog', { name: 'Tu nombre' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: name } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));
  }

  const renamed = (name: string) => Response.json({ player: { playerId: me.playerId, name } });

  test('the greeting shows the new name at once and the device keeps it, sent without a room', async () => {
    signIn();
    const mock = mockApi({ 'GET /api/players/me': meOk });
    const { queryClient } = renderApp('/');
    const answer = deferRename(mock);

    await saveName('  Tía   Marta ');

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(screen.getByText(/Hola,/)).toHaveTextContent('Hola, Tía Marta');
    });
    await waitFor(() => {
      expect(mock.calls.some((call) => call.route === 'PATCH /api/players/me')).toBe(true);
    });
    const sent = mock.calls.find((call) => call.route === 'PATCH /api/players/me')?.init.body;
    expect(typeof sent === 'string' ? JSON.parse(sent) : sent).toEqual({ name: 'Tía Marta' });

    answer(renamed('Tía Marta'));
    await waitFor(() => {
      expect(loadIdentity()?.name).toBe('Tía Marta');
    });
    expect(queryClient.getQueryData(['identity'])).toMatchObject({ name: 'Tía Marta' });
  });

  test('a refusal brings the old name back and shows the server message', async () => {
    signIn();
    mockApi({
      'GET /api/players/me': meOk,
      'PATCH /api/players/me': () =>
        apiError(409, 'NAME_TAKEN', 'Ese nombre ya lo tiene otra persona'),
    });
    renderApp('/');

    await saveName('Tía Marta');

    expect(await screen.findByText('Ese nombre ya lo tiene otra persona')).toBeVisible();
    expect(screen.getByText(/Hola,/)).toHaveTextContent(`Hola, ${me.name}`);
    expect(loadIdentity()?.name).toBe(me.name);
  });

  test('the dialog refuses an invalid name and sends nothing', async () => {
    signIn();
    const mock = mockApi({ 'GET /api/players/me': meOk });
    renderApp('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar tu nombre' }));
    const dialog = screen.getByRole('dialog', { name: 'Tu nombre' });
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: ' A ' } });

    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled();
    expect(within(dialog).getByText('Entre 2 y 20 caracteres visibles')).toBeVisible();
    expect(mock.calls.map((call) => call.route)).not.toContain('PATCH /api/players/me');
  });

  test('Crear sala waits for the rename in flight, so the room never gets the old name', async () => {
    signIn();
    const room = snapshot({ roomCode: 'QRST' });
    const mock = mockApi({
      'GET /api/players/me': meOk,
      'POST /api/rooms': () => Response.json({ room }, { status: 201 }),
      'POST /api/rooms/QRST/join': () => Response.json({ room }),
    });
    const { router } = renderApp('/');
    const answer = deferRename(mock);

    await saveName('Tía Marta');
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }));

    await waitFor(() => {
      expect(mock.calls.some((call) => call.route === 'PATCH /api/players/me')).toBe(true);
    });
    expect(screen.getByRole('button', { name: 'Crear sala' })).toHaveAttribute('aria-busy', 'true');
    expect(mock.calls.map((call) => call.route)).not.toContain('POST /api/rooms');

    answer(renamed('Tía Marta'));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/QRST');
    });
    const routes = mock.calls.map((call) => call.route);
    expect(routes.indexOf('POST /api/rooms')).toBeGreaterThan(
      routes.indexOf('PATCH /api/players/me'),
    );
  });

  test('Unirme waits for the rename in flight, even when it is refused', async () => {
    signIn();
    const mock = mockApi({ 'GET /api/players/me': meOk });
    const { router } = renderApp('/');
    const answer = deferRename(mock);

    await saveName('Tía Marta');
    fireEvent.change(screen.getByLabelText('Código de sala'), { target: { value: 'ABCD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Unirme' }));

    expect(screen.getByRole('button', { name: 'Unirme' })).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => {
      expect(mock.calls.some((call) => call.route === 'PATCH /api/players/me')).toBe(true);
    });
    expect(router.state.location.pathname).toBe('/');

    answer(apiError(409, 'NAME_TAKEN', 'Ese nombre ya lo tiene otra persona'));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/ABCD');
    });
    expect(loadIdentity()?.name).toBe(me.name);
  });
});
