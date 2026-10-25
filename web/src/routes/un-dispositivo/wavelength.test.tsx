import {
  dialPoints,
  psychicPoints,
  type CommittedGuess,
  type Player,
  type WavelengthPublic,
} from '@family-night/shared';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { me, mockApi, renderApp, signIn } from '../../test/app';
import { spokenText } from '../../test/text';

const MATCH_KEY = 'family-night.one-device.wavelength';
const SPECTRA_KEY = 'family-night.one-device.wavelength.spectra';

interface Stored {
  players: Player[];
  match: WavelengthPublic;
  target: number;
  guesses: CommittedGuess[];
}

function stored(): Stored {
  const raw = localStorage.getItem(MATCH_KEY);
  if (raw === null) throw new Error('no stored one device match');
  return JSON.parse(raw) as Stored;
}

function nameOf(playerId: string): string {
  const player = stored().players.find((candidate) => candidate.playerId === playerId);
  if (!player) throw new Error(`no player ${playerId}`);
  return player.name;
}

function hasTarget(): boolean {
  return document.querySelector('[data-points]') !== null;
}

function hasMarkers(): boolean {
  return document.querySelector('[data-marker]') !== null;
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
  expect(document.body.textContent.toLowerCase()).not.toContain('celular');
}

async function setUp(names: string[]) {
  const api = mockApi();
  renderApp('/un-dispositivo/wavelength');
  await screen.findByRole('heading', { name: '¿Quiénes juegan?' });
  for (let i = 2; i < names.length; i++) click('Agregar jugador');
  names.forEach((name, index) => {
    fireEvent.change(screen.getByLabelText(`Jugador ${String(index + 1)}`), {
      target: { value: name },
    });
  });
  click('Empezar');
  await screen.findByRole('heading', { name: /^Le toca a / });
  return api;
}

function reload() {
  cleanup();
  renderApp('/un-dispositivo/wavelength');
}

function setDial(value: number) {
  const slider = screen.getByRole('slider', { name: 'Tu respuesta' });
  fireEvent.keyDown(slider, { key: 'Home' });
  for (let step = 0; step < value; step++) fireEvent.keyDown(slider, { key: 'ArrowRight' });
  expect(slider).toHaveAttribute('aria-valuenow', String(value));
}

function seatingAfterPsychic(): string[] {
  const { match } = stored();
  const seat = match.participants.indexOf(match.psychicId);
  return [...match.participants.slice(seat + 1), ...match.participants.slice(0, seat)].map(nameOf);
}

async function giveClue() {
  click('Ver el objetivo');
  click('Listo');
  await screen.findByRole('heading', { name: /^Pasa el dispositivo a / });
}

async function guess(value: number) {
  const heading = screen.getByRole('heading', { name: /^Pasa el dispositivo a / });
  const name = heading.textContent.replace('Pasa el dispositivo a ', '');
  click(`Soy ${name}`);
  setDial(value);
  click('Confirmar');
  await waitFor(() => {
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
  });
  return name;
}

async function playRound(values: (target: number) => number[]) {
  await giveClue();
  const chosen = values(stored().target);
  for (const value of chosen) await guess(value);
  click('Revelar');
  await screen.findByRole('heading', { name: /^El objetivo era / });
}

function psychicOnScreen(): string {
  const heading = screen.getByRole('heading', { name: /^Le toca a / });
  return heading.textContent.replace('Le toca a ', '');
}

function scoreOf(board: string, name: string): string {
  const list = screen.getByRole('list', { name: board });
  const row = within(list).getByText(name).closest('li');
  if (!row) throw new Error(`no row for ${name}`);
  return spokenText(row);
}

describe('Wavelength on one device', () => {
  test('from home to a revealed round without a single request to /api', async () => {
    signIn();
    const api = mockApi({
      'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
    });
    const { router } = renderApp('/');
    fireEvent.click(await screen.findByRole('button', { name: 'Un solo dispositivo' }));
    const before = api.calls.length;

    fireEvent.click(await screen.findByRole('button', { name: 'Jugar Wavelength' }));
    expect(screen.queryByRole('button', { name: 'Jugar Impostor' })).not.toBeInTheDocument();
    await screen.findByRole('heading', { name: '¿Quiénes juegan?' });
    fireEvent.change(screen.getByLabelText('Jugador 1'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByLabelText('Jugador 2'), { target: { value: 'Beto' } });
    click('Empezar');
    await screen.findByRole('heading', { name: /^Le toca a / });
    await playRound((target) => [target]);

    expect(router.state.location.pathname).toBe('/un-dispositivo/wavelength');
    expect(api.calls.slice(before)).toEqual([]);
  });

  test('the picker offers only Wavelength on one device', async () => {
    mockApi();
    renderApp('/un-dispositivo');

    expect(await screen.findByRole('button', { name: 'Jugar Wavelength' })).toBeEnabled();
    const games = screen.getByRole('list', { name: 'Juegos' });
    for (const game of ['Impostor', 'Just One', 'La manada']) {
      const card = within(games).getByText(game).closest('li');
      expect(card).toHaveTextContent('Todavía no se juega en un solo dispositivo.');
      expect(screen.queryByRole('button', { name: `Jugar ${game}` })).not.toBeInTheDocument();
    }
  });

  test('the target shows only after the psychic taps and the device goes round the table from the psychic', async () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => array);
    await setUp(['Ana', 'Beto', 'Caro']);
    expect(psychicOnScreen()).toBe('Beto');

    expect(hasTarget()).toBe(false);
    click('Ver el objetivo');
    expect(screen.getByRole('img', { name: 'El objetivo' })).toBeVisible();
    expect(hasTarget()).toBe(true);
    click('Listo');

    const first = 'Caro';
    expect(
      await screen.findByRole('heading', { name: `Pasa el dispositivo a ${first}` }),
    ).toBeVisible();
    expect(hasTarget()).toBe(false);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();

    click(`Soy ${first}`);
    expect(screen.getByRole('slider', { name: 'Tu respuesta' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(hasTarget()).toBe(false);
    setDial(80);
    click('Confirmar');

    const second = 'Ana';
    expect(
      await screen.findByRole('heading', { name: `Pasa el dispositivo a ${second}` }),
    ).toBeVisible();
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();
    expect(hasMarkers()).toBe(false);
    expect(document.body).not.toHaveTextContent('80');

    click(`Soy ${second}`);
    expect(screen.getByRole('slider', { name: 'Tu respuesta' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(hasMarkers()).toBe(false);
    click('Confirmar');

    expect(await screen.findByRole('heading', { name: 'Todos adivinaron' })).toBeVisible();
    expect(hasTarget()).toBe(false);
    expect(hasMarkers()).toBe(false);
  });

  test('the keyboard drives the turn: Enter taps each gate, the dial takes focus and Enter confirms it', async () => {
    await setUp(['Ana', 'Beto', 'Caro']);
    const enter = (repeat = false) => {
      fireEvent.keyDown(document.body, { key: 'Enter', repeat });
    };

    enter(true);
    expect(hasTarget()).toBe(false);
    enter();
    expect(hasTarget()).toBe(true);
    enter();

    const [first] = seatingAfterPsychic();
    await screen.findByRole('heading', { name: `Pasa el dispositivo a ${first ?? ''}` });
    enter();
    const slider = screen.getByRole('slider', { name: 'Tu respuesta' });
    expect(slider).toHaveFocus();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'PageUp' });
    fireEvent.keyDown(slider, { key: 'Enter', repeat: true });
    expect(slider).toBeInTheDocument();
    fireEvent.keyDown(slider, { key: 'Enter' });

    await screen.findByRole('heading', { name: /^Pasa el dispositivo a / });
    expect(slider).not.toBeInTheDocument();
    expect(stored().guesses).toEqual([
      { playerId: stored().match.committedPlayerIds[0], value: 61 },
    ]);

    enter();
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Tu respuesta' }), { key: 'Enter' });
    expect(await screen.findByRole('heading', { name: 'Todos adivinaron' })).toBeVisible();
    enter();
    expect(await screen.findByRole('heading', { name: /^El objetivo era / })).toBeVisible();
  });

  test('the reveal scores by the shared rules and totals add up over two rounds', async () => {
    await setUp(['Ana', 'Beto', 'Caro']);
    const totals: Record<string, number> = { Ana: 0, Beto: 0, Caro: 0 };

    for (let round = 1; round <= 2; round++) {
      const psychic = psychicOnScreen();
      const { target } = stored();
      const values = [target, target > 50 ? target - 10 : target + 10];
      const points = values.map((value) => dialPoints(value, target));
      await giveClue();
      const guessers = [];
      for (const value of values) guessers.push(await guess(value));
      click('Revelar');

      expect(
        await screen.findByRole('heading', { name: `El objetivo era ${String(target)}` }),
      ).toBeVisible();
      const earned = psychicPoints(points);
      totals[psychic] = (totals[psychic] ?? 0) + earned;
      guessers.forEach((name, index) => {
        totals[name] = (totals[name] ?? 0) + (points[index] ?? 0);
        expect(scoreOf('Puntos de la ronda', name)).toBe(
          `${name} marcó ${String(values[index])}+${String(points[index])}`,
        );
      });
      expect(scoreOf('Puntos de la ronda', psychic)).toBe(
        `${psychic} (psíquico)+${String(earned)}`,
      );
      for (const [name, total] of Object.entries(totals)) {
        expect(scoreOf('Puntaje', name)).toMatch(new RegExp(`${name}${String(total)}$`));
      }
      expect(document.querySelectorAll('[data-marker]')).toHaveLength(2);

      click('Siguiente ronda');
      await screen.findByRole('heading', { name: /^Le toca a / });
    }
  });

  test('rounds cycle past a full turn and Terminar names a tie', async () => {
    await setUp(['Ana', 'Beto']);
    const psychics: string[] = [];

    for (let round = 1; round <= 3; round++) {
      psychics.push(psychicOnScreen());
      await playRound((target) => [target]);
      if (round < 3) {
        click('Siguiente ronda');
        await screen.findByRole('heading', { name: /^Le toca a / });
      }
    }

    expect(psychics[0]).not.toBe(psychics[1]);
    expect(psychics[2]).toBe(psychics[0]);
    expect(screen.getByRole('heading', { name: 'Ronda 3' })).toBeVisible();

    click('Terminar');
    click('Sí, terminar');

    expect(await screen.findByRole('heading', { name: 'Empate: Ana, Beto' })).toBeVisible();
    expect(scoreOf('Puntos de esta partida', 'Ana')).toMatch(/Ana12$/);
    expect(scoreOf('Puntos de esta partida', 'Beto')).toMatch(/Beto12$/);
    expect(screen.getByText('Wavelength, 3 rondas')).toBeVisible();
    expect(document.body).not.toHaveTextContent('a la noche');
    expect(document.body).not.toHaveTextContent('Esperando al host');
    expect(localStorage.getItem(MATCH_KEY)).toBeNull();
  });

  test('Terminar mid-round drops that round and Jugar otra vez keeps the players with fresh scores and scales', async () => {
    await setUp(['Ana', 'Beto', 'Caro']);
    await playRound((target) => [target, target]);
    const firstSpectrum = stored().match.spectrum.id;
    const after = Object.fromEntries(
      ['Ana', 'Beto', 'Caro'].map((name) => [name, scoreOf('Puntaje', name)]),
    );
    click('Siguiente ronda');
    await giveClue();
    await guess(0);

    click('Opciones de la partida');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Terminar partida' }));
    expect(
      screen.getByRole('alertdialog', {
        name: '¿Terminar la partida? Esta ronda no suma puntos.',
      }),
    ).toBeVisible();
    click('Sí, terminar');

    await screen.findByRole('heading', { name: /^Ganó |^Empate/ });
    expect(screen.getByText('Wavelength, 1 ronda')).toBeVisible();
    for (const name of ['Ana', 'Beto', 'Caro']) {
      const total = /(\d+)$/.exec(after[name] ?? '')?.[1] ?? '';
      expect(scoreOf('Puntos de esta partida', name)).toMatch(new RegExp(`${name}${total}$`));
    }

    click('Jugar otra vez');
    await screen.findByRole('heading', { name: /^Le toca a / });
    const again = stored();
    expect(again.players.map((player) => player.name)).toEqual(['Ana', 'Beto', 'Caro']);
    expect(Object.values(again.match.totals)).toEqual([0, 0, 0]);
    expect(again.match.round).toBe(1);
    const used = JSON.parse(localStorage.getItem(SPECTRA_KEY) ?? '[]') as string[];
    expect(used).toContain(firstSpectrum);
    expect(used).toHaveLength(3);
    expect(new Set(used).size).toBe(3);
    expect(used.at(-1)).toBe(again.match.spectrum.id);
  });

  test('a reload resumes the same match at the gate of every step', async () => {
    const api = await setUp(['Ana', 'Beto', 'Caro']);
    const psychic = psychicOnScreen();
    const [first, second] = seatingAfterPsychic();

    reload();
    expect(await screen.findByRole('heading', { name: `Le toca a ${psychic}` })).toBeVisible();

    click('Ver el objetivo');
    reload();
    expect(await screen.findByRole('heading', { name: `Le toca a ${psychic}` })).toBeVisible();
    expect(hasTarget()).toBe(false);

    await giveClue();
    reload();
    expect(
      await screen.findByRole('heading', { name: `Pasa el dispositivo a ${first ?? ''}` }),
    ).toBeVisible();

    click(`Soy ${first ?? ''}`);
    setDial(30);
    reload();
    expect(
      await screen.findByRole('heading', { name: `Pasa el dispositivo a ${first ?? ''}` }),
    ).toBeVisible();
    click(`Soy ${first ?? ''}`);
    expect(screen.getByRole('slider', { name: 'Tu respuesta' })).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    setDial(70);
    click('Confirmar');

    reload();
    expect(
      await screen.findByRole('heading', { name: `Pasa el dispositivo a ${second ?? ''}` }),
    ).toBeVisible();
    await guess(40);

    reload();
    expect(await screen.findByRole('heading', { name: 'Todos adivinaron' })).toBeVisible();
    click('Revelar');

    reload();
    const { target } = stored();
    expect(
      await screen.findByRole('heading', { name: `El objetivo era ${String(target)}` }),
    ).toBeVisible();
    expect(scoreOf('Puntos de la ronda', first ?? '')).toContain('marcó 70');
    expect(scoreOf('Puntos de la ronda', second ?? '')).toContain('marcó 40');

    cleanup();
    renderApp('/un-dispositivo');
    expect(
      await screen.findByRole('heading', { name: `El objetivo era ${String(target)}` }),
    ).toBeVisible();
    expect(api.calls).toEqual([]);
  });

  test('a stored match that does not hold together is dropped for a new setup', async () => {
    mockApi();
    localStorage.setItem(MATCH_KEY, JSON.stringify({ version: 1, players: [], target: 500 }));

    renderApp('/un-dispositivo/wavelength');

    expect(await screen.findByRole('heading', { name: '¿Quiénes juegan?' })).toBeVisible();
    expect(localStorage.getItem(MATCH_KEY)).toBeNull();
  });
});

describe('the player setup', () => {
  async function open() {
    mockApi();
    renderApp('/un-dispositivo/wavelength');
    await screen.findByRole('heading', { name: '¿Quiénes juegan?' });
  }

  function type(seat: number, value: string) {
    fireEvent.change(screen.getByLabelText(`Jugador ${String(seat)}`), { target: { value } });
  }

  test('a name needs 2 to 20 visible characters', async () => {
    await open();
    type(2, 'Beto');

    type(1, 'A');
    expect(screen.getByText('Entre 2 y 20 caracteres visibles')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeDisabled();

    type(1, 'A'.repeat(21));
    expect(screen.getByText('Entre 2 y 20 caracteres visibles')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeDisabled();

    type(1, '   ');
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeDisabled();

    type(1, '  Ana   María ');
    expect(screen.queryByText('Entre 2 y 20 caracteres visibles')).not.toBeInTheDocument();
    click('Empezar');
    await screen.findByRole('heading', { name: /^Le toca a / });
    expect(stored().players.map((player) => player.name)).toEqual(['Ana María', 'Beto']);
  });

  test('names are unique ignoring case and accents', async () => {
    await open();
    type(1, 'Ána');
    type(2, 'ana');

    expect(screen.getByText('Otro jugador ya se llama así')).toBeVisible();
    expect(screen.getByLabelText('Jugador 2')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Jugador 1')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeDisabled();

    type(2, 'Anita');
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeEnabled();
  });

  test('a match takes 2 to 12 players', async () => {
    await open();
    expect(screen.queryByRole('button', { name: /^Quitar/ })).not.toBeInTheDocument();

    for (let added = 3; added <= 12; added++) click('Agregar jugador');
    expect(screen.getAllByRole('textbox')).toHaveLength(12);
    expect(screen.getByRole('button', { name: 'Máximo 12 jugadores' })).toBeDisabled();

    click('Quitar jugador 12');
    expect(screen.getAllByRole('textbox')).toHaveLength(11);
    expect(screen.getByRole('button', { name: 'Agregar jugador' })).toBeEnabled();
  });
});
