import { join } from 'node:path';
import {
  IMPOSTOR_DEFAULTS,
  WAVELENGTH_DEFAULTS,
  type ImpostorPublic,
  type ImpostorSecret,
  type RoomMember,
  type RoomSnapshot,
  type WavelengthPublic,
  type WavelengthSecret,
} from '@family-night/shared';
import { expect, type Page, test } from '@playwright/test';
import { impostorMatch, MATCH_ID } from '../src/test/impostor-match';
import { WAVELENGTH_MATCH_ID, wavelengthMatch } from '../src/test/wavelength-match';

const me = {
  playerId: '11111111-1111-4111-8111-111111111111',
  playerToken: 'screenshot-token',
  name: 'Cóndor Veloz',
};

function member(playerId: string, name: string, secondsAgo = 0, totalScore = 0): RoomMember {
  const lastSeenAt = new Date(Date.now() - secondsAgo * 1000).toISOString();
  return {
    playerId,
    name,
    online: secondsAgo < 45,
    lastSeenAt,
    totalScore,
    joinedAt: lastSeenAt,
  };
}

const family = [
  member(me.playerId, me.name),
  member('22222222-2222-4222-8222-222222222222', 'Zorro Astuto', 5, 3),
  member('33333333-3333-4333-8333-333333333333', 'Oso Sabio', 120, 1),
  member('44444444-4444-4444-8444-444444444444', 'Colibrí Risueño', 10),
  member('55555555-5555-4555-8555-555555555555', 'Hipopótamo Majestuoso', 300),
];

const categories = [
  ['animales', 'Animales'],
  ['comida', 'Comida'],
  ['lugares', 'Lugares'],
  ['objetos-casa', 'Objetos de la casa'],
  ['profesiones', 'Profesiones'],
  ['deportes', 'Deportes'],
  ['peliculas-series', 'Películas y series'],
  ['marcas', 'Marcas'],
  ['paises-ciudades', 'Países y ciudades'],
  ['familia', 'Cosas de la familia'],
].map(([id, name]) => ({ id, name, count: 25 }));

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    roomCode: 'KXPR',
    version: 7,
    hostId: me.playerId,
    members: [member(me.playerId, me.name)],
    currentMatch: null,
    selectedGame: 'IMPOSTOR',
    configs: {
      IMPOSTOR: {
        ...IMPOSTOR_DEFAULTS,
        categories: ['animales', 'comida', 'lugares', 'deportes', 'familia'],
      },
      WAVELENGTH: { ...WAVELENGTH_DEFAULTS },
    },
    serverTime: new Date().toISOString(),
    ...overrides,
  };
}

async function signIn(page: Page) {
  await page.addInitScript((identity) => {
    localStorage.setItem('family-night.identity', JSON.stringify(identity));
  }, me);
  await page.route('**/api/players/me', (route) =>
    route.fulfill({ json: { playerId: me.playerId, name: me.name } }),
  );
  await page.route('**/api/words/categories', (route) => route.fulfill({ json: { categories } }));
}

async function serveRoom(page: Page, snapshot: RoomSnapshot) {
  await page.route(`**/api/rooms/${snapshot.roomCode}**`, (route) =>
    route.fulfill({ json: { room: snapshot } }),
  );
}

async function capture(page: Page, name: string, fullPage = true) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${name} overflows horizontally`).toBe(0);
  const width = String(page.viewportSize()?.width ?? 0);
  await page.screenshot({
    path: join(process.env.SCREENSHOTS_DIR ?? '', `${width}-${name}.png`),
    fullPage,
    animations: 'disabled',
  });
}

test('home', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  await expect(page.getByText('Hola,')).toBeVisible();
  await page.getByLabel('Código de sala').fill('kxpr');
  await capture(page, 'home');
});

test('lobby as host, alone', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room());
  await page.goto('/KXPR');
  await expect(page.getByText('1 de 1 en línea')).toBeVisible();
  await capture(page, 'lobby-host-empty');
});

test('lobby as host with members online and away', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: family }));
  await page.goto('/KXPR');
  await expect(page.getByText('3 de 5 en línea')).toBeVisible();
  await capture(page, 'lobby-host');
  await page.getByRole('button', { name: 'Opciones para Zorro Astuto' }).click();
  await expect(page.getByRole('menuitem', { name: 'Hacer host' })).toBeVisible();
  await capture(page, 'lobby-host-menu');
});

test('lobby as member', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: family, hostId: family[1]?.playerId ?? '' }));
  await page.goto('/KXPR');
  await expect(page.getByText('Esperando a que el host inicie…')).toBeVisible();
  await capture(page, 'lobby-member');
  await page.getByRole('button', { name: 'Salir de la sala' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'lobby-leave-confirm', false);
});

test('room not found', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/rooms/ZZZZ/join', (route) =>
    route.fulfill({
      status: 404,
      json: { error: { code: 'ROOM_NOT_FOUND', message: 'Esta sala no existe o ya expiró' } },
    }),
  );
  await page.goto('/ZZZZ');
  await expect(
    page.getByRole('heading', { name: 'Esta sala no existe o ya expiró' }),
  ).toBeVisible();
  await capture(page, 'room-not-found');
});

test('room full', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/rooms/ZZZZ/join', (route) =>
    route.fulfill({
      status: 409,
      json: { error: { code: 'ROOM_FULL', message: 'La sala está llena, ya hay 20 jugadores' } },
    }),
  );
  await page.goto('/ZZZZ');
  await expect(
    page.getByRole('heading', { name: 'La sala está llena, ya hay 20 jugadores' }),
  ).toBeVisible();
  await capture(page, 'room-full');
});

const ids = family.map((player) => player.playerId);
const [, zorro = '', oso = '', colibri = '', hipo = ''] = ids;
const civilian: ImpostorSecret = { role: 'CIVILIAN', word: 'Palta', category: 'Comida' };
const impostor: ImpostorSecret = { role: 'IMPOSTOR', clue: 'Ensalada', category: 'Comida' };
const online = family.map((player) => ({
  ...player,
  online: true,
  lastSeenAt: new Date().toISOString(),
}));

async function serveMatch(
  page: Page,
  match: ImpostorPublic,
  secret: ImpostorSecret | null = civilian,
  overrides: Partial<RoomSnapshot> = {},
) {
  await signIn(page);
  await serveRoom(page, room({ members: online, currentMatch: match, ...overrides }));
  await page.route(`**/api/rooms/KXPR/matches/${MATCH_ID}/me`, (route) =>
    route.fulfill({ json: { secret } }),
  );
  await page.goto('/KXPR');
  await expect(page.getByRole('heading', { name: /^(Ronda|Fin de la partida)/ })).toBeVisible();
}

function voting(overrides: Partial<ImpostorPublic> = {}) {
  return impostorMatch([oso, me.playerId, zorro, colibri, hipo], {
    votedPlayerIds: [zorro, colibri],
    ...overrides,
  });
}

function revealed(eliminatedId: string | null, wasImpostor: boolean, tie = false): ImpostorPublic {
  const tally = [
    { playerId: zorro, votes: 2 },
    { playerId: oso, votes: tie ? 2 : 1 },
    { playerId: colibri, votes: 1 },
    { playerId: me.playerId, votes: 0 },
    { playerId: hipo, votes: 0 },
  ];
  return impostorMatch(ids, {
    phase: 'REVEAL',
    votedPlayerIds: ids,
    order: ids.filter((id) => id !== eliminatedId),
    lastResult: { round: 1, tally, tie, eliminatedId },
    eliminated: eliminatedId
      ? [{ playerId: eliminatedId, round: 1, wasImpostor, reason: tie ? 'TIE_RANDOM' : 'VOTE' }]
      : [],
  });
}

function guessing(guesserId: string): ImpostorPublic {
  return {
    ...revealed(guesserId, true),
    phase: 'IMPOSTOR_GUESS',
    guess: {
      guesserId,
      options: ['Mango', 'Palta', 'Choclo', 'Fresa', 'Queso'],
      chosen: null,
      correct: null,
    },
  };
}

function finished(winner: 'CIVILIANS' | 'IMPOSTORS'): ImpostorPublic {
  const match = guessing(zorro);
  return {
    ...match,
    round: 2,
    status: 'FINISHED',
    phase: 'FINISHED',
    winner,
    eliminated: [
      { playerId: hipo, round: 1, wasImpostor: false, reason: 'VOTE' },
      { playerId: zorro, round: 2, wasImpostor: true, reason: 'VOTE' },
    ],
    guess: match.guess && {
      ...match.guess,
      chosen: winner === 'IMPOSTORS' ? 'Palta' : 'Mango',
      correct: winner === 'IMPOSTORS',
    },
    reveal: { word: 'Palta', category: 'Comida', impostorIds: [zorro] },
  };
}

test('lobby as host with the Impostor config', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: online }));
  await page.goto('/KXPR');
  await expect(page.getByRole('button', { name: 'Iniciar' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Animales' })).toBeVisible();
  await capture(page, 'lobby-host-config');
});

test('lobby as host missing players', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: family.slice(0, 3) }));
  await page.goto('/KXPR');
  await expect(page.getByRole('button', { name: 'Faltan 1 jugador' })).toBeDisabled();
  await capture(page, 'lobby-host-missing-players');
});

test('impostor card hidden and shown, civilian', async ({ page }) => {
  await serveMatch(page, voting());
  const card = page.getByRole('button', { name: /Toca para ver tu carta/ });
  await expect(card).toBeVisible();
  await capture(page, 'impostor-voting-card-hidden');
  await card.click();
  await expect(page.getByText('Palta')).toBeVisible();
  await capture(page, 'impostor-card-civilian');
});

test('impostor card shown, impostor', async ({ page }) => {
  await serveMatch(page, voting(), impostor);
  await page.getByRole('button', { name: /Toca para ver tu carta/ }).click();
  await expect(page.getByText('Eres el impostor')).toBeVisible();
  await capture(page, 'impostor-card-impostor');
});

test('impostor voting with my vote and the close confirmation', async ({ page }) => {
  await serveMatch(page, voting());
  await page.route(`**/api/rooms/KXPR/matches/${MATCH_ID}/votes`, (route) =>
    route.fulfill({
      json: {
        room: room({
          members: online,
          version: 8,
          currentMatch: voting({ votedPlayerIds: [zorro, colibri, me.playerId] }),
        }),
      },
    }),
  );
  await page.getByRole('button', { name: /Oso Sabio/ }).click();
  await expect(page.getByText('Votaron 3 de 5')).toBeVisible();
  await capture(page, 'impostor-voting');
  await page.getByRole('button', { name: 'Cerrar votación' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'impostor-voting-close-confirm', false);
});

test('impostor voting, eliminated', async ({ page }) => {
  const match = voting({
    round: 2,
    order: [oso, zorro, colibri, hipo],
    eliminated: [{ playerId: me.playerId, round: 1, wasImpostor: false, reason: 'VOTE' }],
  });
  await serveMatch(page, match, civilian, { hostId: zorro });
  await expect(page.getByText('Eliminado')).toBeVisible();
  await capture(page, 'impostor-eliminated');
});

test('impostor voting, spectator', async ({ page }) => {
  await serveMatch(page, impostorMatch([zorro, oso, colibri, hipo]), null, { hostId: zorro });
  await expect(page.getByText('Partida en curso, juegas en la siguiente')).toBeVisible();
  await capture(page, 'impostor-spectator');
});

test('impostor reveal, eliminated impostor', async ({ page }) => {
  await serveMatch(page, revealed(zorro, true));
  await expect(page.getByText('Era impostor')).toBeVisible();
  await capture(page, 'impostor-reveal-impostor');
});

test('impostor reveal, eliminated civilian', async ({ page }) => {
  await serveMatch(page, revealed(zorro, false), civilian, { hostId: zorro });
  await expect(page.getByText('No era impostor')).toBeVisible();
  await capture(page, 'impostor-reveal-civilian');
});

test('impostor reveal, tie', async ({ page }) => {
  await serveMatch(page, revealed(null, false, true));
  await expect(page.getByText('Empate: nadie es eliminado')).toBeVisible();
  await capture(page, 'impostor-reveal-tie');
});

test('impostor reveal, tie broken by lot', async ({ page }) => {
  await serveMatch(page, revealed(oso, false, true));
  await expect(page.getByText('Empate: eliminado por sorteo')).toBeVisible();
  await capture(page, 'impostor-reveal-tie-random');
});

test('impostor last chance, guesser', async ({ page }) => {
  await serveMatch(page, guessing(me.playerId), impostor);
  await expect(page.getByText('¡Te atraparon!')).toBeVisible();
  await capture(page, 'impostor-last-chance-guesser');
});

test('impostor last chance, others with the guesser offline', async ({ page }) => {
  const members = online.map((player) =>
    player.playerId === zorro
      ? { ...player, online: false, lastSeenAt: new Date(Date.now() - 120_000).toISOString() }
      : player,
  );
  await serveMatch(page, guessing(zorro), civilian, { members });
  await expect(page.getByRole('button', { name: 'Saltar' })).toBeVisible();
  await capture(page, 'impostor-last-chance-others');
});

test('impostor final, civilians win', async ({ page }) => {
  await serveMatch(page, finished('CIVILIANS'));
  await expect(page.getByText('Ganaron los civiles')).toBeVisible();
  await capture(page, 'impostor-final-civilians');
});

test('impostor final, impostors win, member view', async ({ page }) => {
  await serveMatch(page, finished('IMPOSTORS'), civilian, { hostId: zorro });
  await expect(page.getByText('Ganaron los impostores')).toBeVisible();
  await capture(page, 'impostor-final-impostors');
});

test('impostor host menu', async ({ page }) => {
  await serveMatch(page, voting());
  await page.getByRole('button', { name: 'Opciones de la partida' }).click();
  await page.getByRole('menuitem', { name: 'Terminar partida' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'impostor-end-confirm', false);
});

const order = [zorro, me.playerId, oso, colibri, hipo];
const target: WavelengthSecret = { role: 'PSYCHIC', round: 2, target: 68 };

async function serveWavelength(
  page: Page,
  match: WavelengthPublic,
  secret: WavelengthSecret | null = null,
  overrides: Partial<RoomSnapshot> = {},
) {
  await signIn(page);
  await serveRoom(
    page,
    room({ members: online, currentMatch: match, selectedGame: 'WAVELENGTH', ...overrides }),
  );
  await page.route(`**/api/rooms/KXPR/matches/${WAVELENGTH_MATCH_ID}/me`, (route) =>
    route.fulfill({ json: { secret } }),
  );
  await page.goto('/KXPR');
  await expect(page.getByRole('heading', { name: /^(Ronda|Fin de la partida)/ })).toBeVisible();
}

function wave(overrides: Partial<WavelengthPublic> = {}): WavelengthPublic {
  return wavelengthMatch(order, {
    round: 2,
    turn: 1,
    psychicId: me.playerId,
    spectrum: {
      id: 'mala-pelicula.buena-pelicula',
      left: 'Mala película',
      right: 'Buena película',
    },
    totals: { [zorro]: 3, [me.playerId]: 4, [oso]: 2, [colibri]: 1, [hipo]: 0 },
    ...overrides,
  });
}

const othersTurn = { psychicId: zorro, turn: 0, round: 1 };

function wavelengthRevealed(overrides: Partial<WavelengthPublic> = {}): WavelengthPublic {
  return wave({
    ...othersTurn,
    phase: 'REVEAL',
    clue: 'Shrek 2',
    committedPlayerIds: [me.playerId, oso, colibri],
    lastResult: {
      round: 1,
      psychicId: zorro,
      target: 68,
      guesses: [
        { playerId: me.playerId, value: 71, points: 4 },
        { playerId: oso, value: 55, points: 2 },
        { playerId: colibri, value: 30, points: 0 },
        { playerId: hipo, value: null, points: 0 },
      ],
      psychicPoints: 2,
    },
    totals: { [zorro]: 2, [me.playerId]: 4, [oso]: 2, [colibri]: 0, [hipo]: 0 },
    ...overrides,
  });
}

test('lobby as host with the Wavelength config', async ({ page }) => {
  await signIn(page);
  await serveRoom(
    page,
    room({
      members: online,
      selectedGame: 'WAVELENGTH',
      configs: { ...room().configs, WAVELENGTH: { cycles: 2 } },
    }),
  );
  await page.goto('/KXPR');
  await expect(page.getByRole('radio', { name: '2' })).toBeChecked();
  await capture(page, 'lobby-host-wavelength');
});

test('lobby as member with Wavelength chosen', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: online, selectedGame: 'WAVELENGTH', hostId: zorro }));
  await page.goto('/KXPR');
  await expect(page.getByText('Esperando a que el host inicie…')).toBeVisible();
  await capture(page, 'lobby-member-wavelength');
});

test('wavelength clue, psychic', async ({ page }) => {
  await serveWavelength(page, wave(), target);
  await expect(page.getByRole('img', { name: 'El objetivo' })).toBeVisible();
  await page.getByLabel('Tu pista').fill('Shrek 2');
  await capture(page, 'wavelength-clue-psychic');
});

test('wavelength clue, others', async ({ page }) => {
  await serveWavelength(page, wave(othersTurn), null, { hostId: zorro });
  await expect(page.getByText('Zorro Astuto está pensando la pista…')).toBeVisible();
  await capture(page, 'wavelength-clue-others');
});

test('wavelength clue, host with the psychic offline after a skip', async ({ page }) => {
  const members = online.map((player) =>
    player.playerId === oso
      ? { ...player, online: false, lastSeenAt: new Date(Date.now() - 120_000).toISOString() }
      : player,
  );
  const match = wave({
    psychicId: oso,
    round: 3,
    turn: 2,
    skipped: { round: 2, psychicId: me.playerId, reason: 'LEFT' },
  });
  await serveWavelength(page, match, null, { members });
  await expect(page.getByRole('button', { name: 'Saltar turno' })).toBeVisible();
  await capture(page, 'wavelength-clue-skip');
  await page.getByRole('button', { name: 'Saltar turno' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'wavelength-clue-skip-confirm', false);
});

test('wavelength guess, before and after committing', async ({ page }) => {
  const match = wave({ ...othersTurn, phase: 'GUESS', clue: 'Shrek 2', committedPlayerIds: [oso] });
  await serveWavelength(page, match, null, { hostId: zorro });
  await page.route(`**/api/rooms/KXPR/matches/${WAVELENGTH_MATCH_ID}/guess`, (route) =>
    route.fulfill({
      json: {
        room: room({
          members: online,
          hostId: zorro,
          version: 8,
          selectedGame: 'WAVELENGTH',
          currentMatch: { ...match, committedPlayerIds: [oso, me.playerId] },
        }),
      },
    }),
  );
  const dial = page.getByRole('slider', { name: 'Tu respuesta' });
  await dial.focus();
  for (let i = 0; i < 2; i++) await page.keyboard.press('PageUp');
  await capture(page, 'wavelength-guess');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('Listo. Esperando a los demás…')).toBeVisible();
  await capture(page, 'wavelength-guess-committed');
});

test('wavelength guess, host', async ({ page }) => {
  const match = wave({ ...othersTurn, phase: 'GUESS', clue: 'Shrek 2', committedPlayerIds: [oso] });
  await serveWavelength(page, match);
  await expect(page.getByRole('button', { name: 'Cerrar' })).toBeVisible();
  await capture(page, 'wavelength-guess-host');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'wavelength-guess-close-confirm', false);
});

test('wavelength guess, psychic waiting', async ({ page }) => {
  await serveWavelength(
    page,
    wave({ phase: 'GUESS', clue: 'Shrek 2', committedPlayerIds: [zorro, oso] }),
    target,
    { hostId: zorro },
  );
  await expect(page.getByRole('img', { name: 'El objetivo' })).toBeVisible();
  await capture(page, 'wavelength-guess-psychic');
});

test('wavelength reveal', async ({ page }) => {
  await serveWavelength(page, wavelengthRevealed());
  await expect(page.getByRole('heading', { name: 'El objetivo era 68' })).toBeVisible();
  await capture(page, 'wavelength-reveal');
});

test('wavelength reveal, member on the last turn', async ({ page }) => {
  await serveWavelength(page, wavelengthRevealed({ turn: 4 }), null, { hostId: zorro });
  await expect(page.getByText('Esperando al host…')).toBeVisible();
  await capture(page, 'wavelength-reveal-member');
});

test('wavelength final', async ({ page }) => {
  await serveWavelength(
    page,
    wavelengthRevealed({ status: 'FINISHED', phase: 'FINISHED', turn: 4, round: 5 }),
  );
  await expect(page.getByRole('heading', { name: 'Ganó Cóndor Veloz' })).toBeVisible();
  await capture(page, 'wavelength-final');
});

test('wavelength final, member', async ({ page }) => {
  await serveWavelength(
    page,
    wavelengthRevealed({ status: 'FINISHED', phase: 'FINISHED', turn: 4, round: 5 }),
    null,
    { hostId: zorro },
  );
  await expect(page.getByText('Esperando al host…')).toBeVisible();
  await capture(page, 'wavelength-final-member');
});

test('wavelength spectator', async ({ page }) => {
  await serveWavelength(
    page,
    wave({ ...othersTurn, phase: 'GUESS', clue: 'Shrek 2', departedIds: [me.playerId] }),
    null,
    { hostId: zorro },
  );
  await expect(page.getByText('Partida en curso, juegas en la siguiente')).toBeVisible();
  await capture(page, 'wavelength-spectator');
});

test('wavelength host menu', async ({ page }) => {
  await serveWavelength(page, wave(othersTurn));
  await page.getByRole('button', { name: 'Opciones de la partida' }).click();
  await page.getByRole('menuitem', { name: 'Terminar partida' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'wavelength-end-confirm', false);
});
