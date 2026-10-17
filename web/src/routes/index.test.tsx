import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { apiError, me, mockApi, renderApp, signIn, snapshot } from '../test/app';

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
