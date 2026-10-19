import { join } from 'node:path';
import {
  finishManada,
  mergeGroups,
  revealManada,
  IMPOSTOR_DEFAULTS,
  JUST_ONE_DEFAULTS,
  MANADA_DEFAULTS,
  WAVELENGTH_DEFAULTS,
  type ImpostorPublic,
  type ImpostorSecret,
  type JustOnePublic,
  type JustOneSecret,
  type ManadaPublic,
  type ManadaSecret,
  type RoomMember,
  type RoomSnapshot,
  type WavelengthPublic,
  type WavelengthSecret,
} from '@family-night/shared';
import { expect, type Page, test } from '@playwright/test';
import { impostorMatch, MATCH_ID } from '../src/test/impostor-match';
import { JUST_ONE_MATCH_ID, justOneMatch } from '../src/test/justone-match';
import { MANADA_MATCH_ID, manadaMatch } from '../src/test/manada-match';
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
      JUST_ONE: { ...JUST_ONE_DEFAULTS },
      MANADA: { ...MANADA_DEFAULTS },
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
  const viewport = page.viewportSize()?.width ?? 0;
  const offenders = await page.evaluate((limit) => {
    const found: string[] = [];
    if (document.documentElement.scrollWidth > limit) {
      found.push(`page is ${String(document.documentElement.scrollWidth)} px wide`);
    }
    for (const input of document.querySelectorAll('input, textarea')) {
      if (input.scrollWidth > input.clientWidth + 1) {
        found.push(`input "${(input as HTMLInputElement).value}" scrolls`);
      }
    }
    for (const element of document.querySelectorAll('body *')) {
      if (element.closest('[aria-hidden="true"], .sr-only')) continue;
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? '')
        .join('');
      if (!text) continue;
      const { left, right, width } = element.getBoundingClientRect();
      const cut =
        element.scrollWidth > element.clientWidth + 1 &&
        getComputedStyle(element).overflowX !== 'visible';
      if (width > 0 && (left < -0.5 || right > limit + 0.5 || cut)) found.push(text);
    }
    return found;
  }, viewport);
  expect(offenders, `${name} overflows or clips text horizontally`).toEqual([]);
  const width = String(viewport);
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

test('home, renaming myself', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/players/me', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          json: { player: { playerId: me.playerId, name: 'Hipopótamo Valiente' } },
        })
      : route.fulfill({ json: { playerId: me.playerId, name: me.name } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Cambiar tu nombre' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tu nombre' });
  await dialog.getByRole('textbox').fill('Hipopótamo Valiente');
  await capture(page, 'home-rename', false);
  await dialog.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Hola,')).toContainText('Hipopótamo Valiente');
  await capture(page, 'home-renamed');
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

test('lobby, renaming myself', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: family }));
  await page.goto('/KXPR');
  await page.getByRole('button', { name: 'Cambiar tu nombre' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tu nombre' });
  await dialog.getByRole('textbox').fill('Tía Marta');
  await capture(page, 'lobby-rename', false);
  await dialog.getByRole('textbox').fill('zorro astuto');
  await expect(dialog.getByText('Alguien de la sala ya se llama así')).toBeVisible();
  await capture(page, 'lobby-rename-taken', false);
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

function civiliansWin(): ImpostorPublic {
  return {
    ...revealed(zorro, true),
    round: 2,
    status: 'FINISHED',
    phase: 'FINISHED',
    winner: 'CIVILIANS',
    eliminated: [
      { playerId: hipo, round: 1, wasImpostor: false, reason: 'VOTE' },
      { playerId: zorro, round: 2, wasImpostor: true, reason: 'VOTE' },
    ],
    reveal: { word: 'Palta', category: 'Comida', impostorIds: [zorro] },
  };
}

function impostorsWin(): ImpostorPublic {
  const civiliansOut = [hipo, oso, colibri];
  return impostorMatch(ids, {
    round: 3,
    status: 'FINISHED',
    phase: 'FINISHED',
    winner: 'IMPOSTORS',
    order: ids.filter((id) => !civiliansOut.includes(id)),
    votedPlayerIds: [me.playerId, zorro, colibri],
    lastResult: {
      round: 3,
      tie: false,
      eliminatedId: colibri,
      tally: [
        { playerId: colibri, votes: 2 },
        { playerId: zorro, votes: 1 },
        { playerId: me.playerId, votes: 0 },
      ],
    },
    eliminated: civiliansOut.map((playerId, index) => ({
      playerId,
      round: index + 1,
      wasImpostor: false,
      reason: 'VOTE' as const,
    })),
    reveal: { word: 'Palta', category: 'Comida', impostorIds: [zorro] },
  });
}

test('lobby as host with the Impostor config', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: online }));
  await page.goto('/KXPR');
  await expect(page.getByRole('button', { name: 'Iniciar' })).toBeEnabled();
  const categoriesToggle = page.getByRole('button', { name: /Categorías/ });
  await expect(categoriesToggle).toContainText('5 de 10');
  await capture(page, 'lobby-host-config');
  await categoriesToggle.click();
  await expect(page.getByRole('button', { name: 'Animales' })).toBeVisible();
  await capture(page, 'lobby-host-config-categories');
});

for (const game of ['Impostor', 'Wavelength', 'Just One', 'La manada']) {
  test(`how to play ${game}, every step`, async ({ page }) => {
    await signIn(page);
    await serveRoom(page, room({ members: online }));
    await page.goto('/KXPR');
    await page.getByRole('button', { name: `¿Cómo jugar ${game}?` }).click();
    const dialog = page.getByRole('dialog', { name: game });
    const label = (await dialog.getByRole('group').getAttribute('aria-label')) ?? '';
    const total = Number(/de (\d+)$/.exec(label)?.[1] ?? 0);
    const slug = game.toLowerCase().replace(' ', '');
    for (let step = 1; step <= total; step++) {
      await expect(dialog.getByRole('group')).toHaveAttribute(
        'aria-label',
        `Paso ${String(step)} de ${String(total)}`,
      );
      await capture(page, `howto-${slug}-${String(step)}`, false);
      if (step < total) await dialog.getByRole('button', { name: 'Siguiente' }).click();
    }
  });
}

test('lobby as host missing players', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: family.slice(0, 3) }));
  await page.goto('/KXPR');
  await expect(page.getByRole('button', { name: 'Falta 1 jugador' })).toBeDisabled();
  await capture(page, 'lobby-host-missing-players');
});

test('lobby as host with Just One missing a player', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: online.slice(0, 3), selectedGame: 'JUST_ONE' }));
  await page.goto('/KXPR');
  await expect(page.getByRole('button', { name: 'Falta 1 jugador' })).toBeDisabled();
  await capture(page, 'lobby-host-justone-missing-players');
});

test('lobby as host with Wavelength and 2 online', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: online.slice(0, 2), selectedGame: 'WAVELENGTH' }));
  await page.goto('/KXPR');
  await expect(page.getByRole('button', { name: 'Iniciar' })).toBeEnabled();
  await capture(page, 'lobby-host-wavelength-two');
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

test('impostor voting: my selection, my confirmed vote and the close confirmation', async ({
  page,
}) => {
  await serveMatch(page, voting());
  await page.route(`**/api/rooms/KXPR/matches/${MATCH_ID}/votes`, (route) => {
    const { confirmed } = route.request().postDataJSON() as { confirmed: boolean };
    const votedPlayerIds = confirmed ? [zorro, colibri, me.playerId] : [zorro, colibri];
    return route.fulfill({
      json: {
        room: room({ members: online, version: 8, currentMatch: voting({ votedPlayerIds }) }),
      },
    });
  });
  await capture(page, 'impostor-voting-open');
  await page.getByRole('button', { name: /Oso Sabio/ }).click();
  await expect(page.getByText('tu elección')).toBeVisible();
  await capture(page, 'impostor-voting-selected');
  await page.getByRole('button', { name: 'Confirmar voto' }).click();
  await expect(page.getByText('Votaron 3 de 5')).toBeVisible();
  await expect(page.getByText('tu voto')).toBeVisible();
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

test('impostor final, civilians win', async ({ page }) => {
  await serveMatch(page, civiliansWin());
  await expect(page.getByText('Ganaron los civiles')).toBeVisible();
  await capture(page, 'impostor-final-civilians');
});

test('impostor final, impostors win, member view', async ({ page }) => {
  await serveMatch(page, impostorsWin(), civilian, { hostId: zorro });
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
        { playerId: me.playerId, value: 70, points: 4 },
        { playerId: oso, value: 60, points: 2 },
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

for (const at of [0, 3, 50, 97, 100]) {
  test(`wavelength dial zones around a target at ${String(at)}`, async ({ page }) => {
    await serveWavelength(page, wave(), { ...target, target: at });
    const dial = page.getByRole('img', { name: 'El objetivo' });
    await expect(dial).toBeVisible();
    await dial.screenshot({
      path: join(
        process.env.SCREENSHOTS_DIR ?? '',
        `${String(page.viewportSize()?.width ?? 0)}-wavelength-dial-${String(at)}.png`,
      ),
    });
  });
}

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

test('wavelength final, two players', async ({ page }) => {
  await serveWavelength(
    page,
    wavelengthMatch([me.playerId, zorro], {
      status: 'FINISHED',
      phase: 'FINISHED',
      turn: 1,
      round: 2,
      totals: { [me.playerId]: 6, [zorro]: 6 },
    }),
    null,
    { members: online.slice(0, 2) },
  );
  await expect(page.getByRole('heading', { name: /^Empate:/ })).toBeVisible();
  await capture(page, 'wavelength-final-two');
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

async function serveJustOne(
  page: Page,
  match: JustOnePublic,
  secret: JustOneSecret | null = null,
  overrides: Partial<RoomSnapshot> = {},
) {
  await signIn(page);
  await serveRoom(
    page,
    room({ members: online, currentMatch: match, selectedGame: 'JUST_ONE', ...overrides }),
  );
  await page.route(`**/api/rooms/KXPR/matches/${JUST_ONE_MATCH_ID}/me`, (route) =>
    route.fulfill({ json: { secret } }),
  );
  await page.goto('/KXPR');
  await expect(page.getByRole('heading', { name: /^(Ronda|Fin de la partida)/ })).toBeVisible();
}

const justOneOrder = [zorro, me.playerId, oso, colibri, hipo];
const givers = [me.playerId, oso, colibri, hipo];
const allClues = [
  { authorId: me.playerId, clue: 'Verde' },
  { authorId: oso, clue: 'Guacamole' },
  { authorId: colibri, clue: 'verdes' },
  { authorId: hipo, clue: 'Hueso' },
];

function word(overrides: Partial<JustOneSecret> = {}): JustOneSecret {
  return { role: 'CLUE_GIVER', round: 2, word: 'Palta', clue: null, clues: [], ...overrides };
}

function jo(overrides: Partial<JustOnePublic> = {}): JustOnePublic {
  return justOneMatch(justOneOrder, { round: 2, turn: 0, score: 1, roundsWon: 1, ...overrides });
}

const asGuesser = { guesserId: me.playerId, turn: 1 };

function joRevealed(outcome: 'CORRECT' | 'WRONG'): JustOnePublic {
  const won = outcome === 'CORRECT';
  return jo({
    ...asGuesser,
    phase: 'REVEAL',
    committedPlayerIds: [zorro, oso, colibri, hipo],
    cancelledAuthorIds: [zorro, colibri],
    clues: [
      { authorId: oso, clue: 'Guacamole' },
      { authorId: hipo, clue: 'Pepa' },
    ],
    score: won ? 2 : 0,
    roundsWon: won ? 2 : 1,
    lastResult: {
      round: 2,
      guesserId: me.playerId,
      word: 'Palta',
      guess: won ? 'palta' : 'Aguacate',
      outcome,
      accepted: false,
      clues: [
        { authorId: zorro, clue: 'Verde', cancelled: true },
        { authorId: oso, clue: 'Guacamole', cancelled: false },
        { authorId: colibri, clue: 'verdes', cancelled: true },
        { authorId: hipo, clue: 'Pepa', cancelled: false },
      ],
      scoreBefore: 1,
      score: won ? 2 : 0,
    },
  });
}

test('lobby as host with the Just One config', async ({ page }) => {
  await signIn(page);
  await serveRoom(
    page,
    room({
      members: online,
      selectedGame: 'JUST_ONE',
      configs: { ...room().configs, JUST_ONE: { cycles: 2 } },
    }),
  );
  await page.goto('/KXPR');
  await expect(page.getByRole('radio', { name: '2' })).toBeChecked();
  await capture(page, 'lobby-host-justone');
});

test('just one clue, clue-giver', async ({ page }) => {
  await serveJustOne(page, jo({ committedPlayerIds: [oso] }), word(), { hostId: zorro });
  await page.getByRole('textbox', { name: 'Tu pista' }).fill('Verde');
  await capture(page, 'justone-clue-giver');
});

test('just one clue, clue-giver committed', async ({ page }) => {
  await serveJustOne(
    page,
    jo({ committedPlayerIds: [oso, me.playerId] }),
    word({ clue: 'Verde' }),
    {
      hostId: zorro,
    },
  );
  await expect(page.getByText('Listo. Esperando a los demás…')).toBeVisible();
  await capture(page, 'justone-clue-giver-committed');
});

test('just one clue, guesser', async ({ page }) => {
  await serveJustOne(page, jo({ ...asGuesser, committedPlayerIds: [oso, colibri] }), null, {
    hostId: zorro,
  });
  await expect(page.getByText('Están escribiendo pistas…')).toBeVisible();
  await capture(page, 'justone-clue-guesser');
});

test('just one clue, host closing early', async ({ page }) => {
  await serveJustOne(page, jo({ committedPlayerIds: [oso] }), word());
  await page.getByRole('button', { name: 'Cerrar pistas' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'justone-clue-close-confirm', false);
});

test('just one clue, host with the guesser offline after a skip', async ({ page }) => {
  const members = online.map((player) =>
    player.playerId === oso
      ? { ...player, online: false, lastSeenAt: new Date(Date.now() - 120_000).toISOString() }
      : player,
  );
  const match = jo({
    guesserId: oso,
    round: 3,
    turn: 2,
    skipped: { round: 2, guesserId: zorro, reason: 'SKIPPED' },
  });
  await serveJustOne(page, match, word({ round: 3 }), { members });
  await expect(page.getByRole('button', { name: 'Saltar turno' })).toBeVisible();
  await capture(page, 'justone-clue-skip');
  await page.getByRole('button', { name: 'Saltar turno' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'justone-clue-skip-confirm', false);
});

test('just one review, clue-giver', async ({ page }) => {
  await serveJustOne(
    page,
    jo({ phase: 'REVIEW', committedPlayerIds: givers, cancelledAuthorIds: [me.playerId, colibri] }),
    word({ clue: 'Verde', clues: allClues }),
    { hostId: zorro },
  );
  await expect(page.getByRole('list', { name: 'Pistas' })).toBeVisible();
  await capture(page, 'justone-review-giver');
});

test('just one review, host who is the guesser', async ({ page }) => {
  await serveJustOne(
    page,
    jo({
      ...asGuesser,
      phase: 'REVIEW',
      committedPlayerIds: [zorro, oso, colibri],
      cancelledAuthorIds: [zorro],
    }),
  );
  await expect(page.getByRole('button', { name: 'Mostrar pistas' })).toBeVisible();
  await capture(page, 'justone-review-host');
});

const guessPhase = {
  phase: 'GUESS' as const,
  committedPlayerIds: [zorro, oso, colibri, hipo],
  cancelledAuthorIds: [zorro, colibri],
  clues: [
    { authorId: oso, clue: 'Guacamole' },
    { authorId: hipo, clue: 'Pepa' },
  ],
};

test('just one guess, guesser', async ({ page }) => {
  await serveJustOne(page, jo({ ...asGuesser, ...guessPhase }), null, { hostId: zorro });
  await page.getByLabel('¿Cuál es la palabra?').fill('Palta');
  await capture(page, 'justone-guess-guesser');
});

test('just one guess, others', async ({ page }) => {
  await serveJustOne(
    page,
    jo({
      ...guessPhase,
      committedPlayerIds: givers,
      clues: [{ authorId: oso, clue: 'Guacamole' }],
    }),
    word({ clues: allClues }),
    { hostId: zorro },
  );
  await expect(page.getByText('Zorro Astuto está adivinando…')).toBeVisible();
  await capture(page, 'justone-guess-others');
});

test('just one reveal, correct', async ({ page }) => {
  await serveJustOne(page, joRevealed('CORRECT'), null, { hostId: zorro });
  await expect(page.getByText('¡Acertaste!')).toBeVisible();
  await capture(page, 'justone-reveal-correct');
});

test('just one reveal, wrong, host', async ({ page }) => {
  await serveJustOne(page, joRevealed('WRONG'));
  await expect(page.getByRole('button', { name: 'Contar como acierto' })).toBeVisible();
  await capture(page, 'justone-reveal-wrong-host');
});

test('just one final', async ({ page }) => {
  await serveJustOne(
    page,
    jo({ status: 'FINISHED', phase: 'FINISHED', round: 5, turn: 4, score: 3, roundsWon: 4 }),
  );
  await expect(page.getByText('Acertaron 4 rondas')).toBeVisible();
  await capture(page, 'justone-final');
});

test('just one spectator', async ({ page }) => {
  await serveJustOne(page, jo({ ...guessPhase, departedIds: [me.playerId] }), null, {
    hostId: zorro,
  });
  await expect(page.getByText('Partida en curso, juegas en la siguiente')).toBeVisible();
  await capture(page, 'justone-spectator');
});

async function serveManada(
  page: Page,
  match: ManadaPublic,
  secret: ManadaSecret | null = null,
  overrides: Partial<RoomSnapshot> = {},
) {
  await signIn(page);
  await serveRoom(
    page,
    room({ members: live(), currentMatch: match, selectedGame: 'MANADA', ...overrides }),
  );
  await page.route(`**/api/rooms/KXPR/matches/${MANADA_MATCH_ID}/me`, (route) =>
    route.fulfill({ json: { secret } }),
  );
  await page.goto('/KXPR');
  await expect(page.getByRole('heading', { name: /^(Ronda|Fin de la partida)/ })).toBeVisible();
}

const herd = [me.playerId, zorro, oso, colibri, hipo];

function live(): RoomMember[] {
  const now = new Date().toISOString();
  return online.map((player) => ({ ...player, lastSeenAt: now }));
}

function mm(overrides: Partial<ManadaPublic> = {}): ManadaPublic {
  return manadaMatch(herd, {
    round: 3,
    totals: { [me.playerId]: 2, [zorro]: 3, [oso]: 1, [colibri]: 2, [hipo]: 0 },
    cowHolderId: colibri,
    ...overrides,
  });
}

function mmRevealed(answers: (string | null)[], overrides: Partial<ManadaPublic> = {}) {
  const given = herd.flatMap((playerId, index) => {
    const answer = answers[index];
    return answer ? [{ playerId, answer }] : [];
  });
  const match = mm(overrides);
  return revealManada(
    { ...match, answeredPlayerIds: given.map((answer) => answer.playerId) },
    given,
  );
}

const yourAnswer = (answer: string | null): ManadaSecret => ({
  role: 'ANSWERER',
  round: 3,
  answer,
});

test('lobby as host with the La manada config', async ({ page }) => {
  await signIn(page);
  await serveRoom(page, room({ members: live(), selectedGame: 'MANADA' }));
  await page.goto('/KXPR');
  await expect(page.getByRole('radio', { name: 'Rondas' })).toBeChecked();
  await capture(page, 'lobby-host-manada');
});

test('lobby as host with La manada until 8 points', async ({ page }) => {
  await signIn(page);
  await serveRoom(
    page,
    room({
      members: live(),
      selectedGame: 'MANADA',
      configs: { ...room().configs, MANADA: { goal: 'POINTS', rounds: 10 } },
    }),
  );
  await page.goto('/KXPR');
  await expect(page.getByRole('radio', { name: '8 puntos' })).toBeChecked();
  await capture(page, 'lobby-host-manada-points');
});

test('lobby as host with La manada missing a player', async ({ page }) => {
  await signIn(page);
  const two = [member(me.playerId, me.name), member(zorro, 'Zorro Astuto')];
  await serveRoom(page, room({ members: two, selectedGame: 'MANADA' }));
  await page.goto('/KXPR');
  await expect(page.getByRole('button', { name: 'Falta 1 jugador' })).toBeDisabled();
  await capture(page, 'lobby-host-manada-missing-players');
});

test('la manada answer, host before confirming', async ({ page }) => {
  await serveManada(page, mm({ answeredPlayerIds: [zorro, hipo] }), yourAnswer(null));
  await page.getByRole('textbox', { name: 'Tu respuesta' }).fill('Plátano frito');
  await capture(page, 'manada-answer-host');
});

test('la manada answer, too many words', async ({ page }) => {
  await serveManada(page, mm(), yourAnswer(null), { hostId: zorro });
  await page.getByRole('textbox', { name: 'Tu respuesta' }).fill('un plátano bien frito');
  await expect(page.getByText('Máximo 3 palabras')).toBeVisible();
  await capture(page, 'manada-answer-too-long');
});

test('la manada answer, confirmed', async ({ page }) => {
  await serveManada(
    page,
    mm({ answeredPlayerIds: [me.playerId, zorro, hipo] }),
    yourAnswer('Plátano frito'),
    { hostId: zorro },
  );
  await expect(page.getByText('Listo. Esperando a los demás…')).toBeVisible();
  await capture(page, 'manada-answer-confirmed');
});

test('la manada answer, host closing early', async ({ page }) => {
  await serveManada(page, mm({ answeredPlayerIds: [zorro, hipo] }), yourAnswer(null));
  await page.getByRole('button', { name: 'Cerrar respuestas' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await capture(page, 'manada-answer-close-confirm', false);
});

test('la manada reveal, the cow moves', async ({ page }) => {
  await serveManada(
    page,
    mmRevealed(['Plátano', 'plátanos', 'Plátano', 'el plátano', 'Mango']),
    null,
    { hostId: zorro },
  );
  await expect(page.getByText('La vaca rosa pasa a Hipopótamo Majestuoso')).toBeVisible();
  await capture(page, 'manada-reveal-cow');
});

test('la manada reveal, a tie and the cow stays, host', async ({ page }) => {
  await serveManada(page, mmRevealed(['Mango', 'mango', 'Piña', 'piñas', null]));
  await expect(page.getByText('Empatan las manadas más grandes: nadie suma')).toBeVisible();
  await capture(page, 'manada-reveal-tie-host');
});

test('la manada reveal, host merging two groups', async ({ page }) => {
  const answers = ['Plátano', 'Banana', 'plátano', 'Mango', 'Banano'];
  await serveManada(page, mmRevealed(answers));
  await page.getByRole('button', { name: 'Elegir el grupo Banana' }).click();
  await expect(page.getByText(/Toca otro grupo para unirlo con «Banana»/)).toBeVisible();
  await capture(page, 'manada-reveal-merging');
});

test('la manada reveal, merged by the host', async ({ page }) => {
  const revealed = mmRevealed(['Plátano', 'Banana', 'plátano', 'Mango', 'Banano'], {
    cowHolderId: oso,
  });
  await serveManada(page, mergeGroups(revealed, zorro, hipo));
  await expect(page.getByText('Unidas por el host')).toBeVisible();
  await capture(page, 'manada-reveal-merged');
});

test('la manada reveal, one group left after a merge, host', async ({ page }) => {
  const tied = mmRevealed(['Mango', 'mango', 'Piña', 'piñas', null]);
  await serveManada(page, mergeGroups(tied, me.playerId, oso));
  await expect(page.getByRole('button', { name: 'Separar' })).toBeVisible();
  await capture(page, 'manada-reveal-merged-single');
});

test('la manada final', async ({ page }) => {
  const finished = finishManada(
    mm({
      round: 9,
      totals: { [me.playerId]: 8, [zorro]: 9, [oso]: 5, [colibri]: 8, [hipo]: 2 },
      cowHolderId: zorro,
    }),
  );
  await serveManada(page, finished);
  await expect(page.getByRole('heading', { name: /^Empate/ })).toBeVisible();
  await capture(page, 'manada-final');
});

test('la manada spectator', async ({ page }) => {
  await serveManada(page, mm({ departedIds: [me.playerId], answeredPlayerIds: [zorro] }), null, {
    hostId: zorro,
  });
  await expect(page.getByText('Partida en curso, juegas en la siguiente')).toBeVisible();
  await capture(page, 'manada-spectator');
});

test.describe('in motion', () => {
  test.use({ reducedMotion: 'no-preference' });

  async function snap(page: Page, name: string) {
    const width = String(page.viewportSize()?.width ?? 0);
    await page.screenshot({
      path: join(process.env.SCREENSHOTS_DIR ?? '', `${width}-motion-${name}.png`),
      animations: 'allow',
    });
  }

  async function midFlip(page: Page, name: string) {
    const flip = page.locator('[data-flip]').first();
    await flip.scrollIntoViewIfNeeded();
    await page.locator('[data-flip="front"]').first().waitFor();
    await page.waitForTimeout(110);
    await snap(page, name);
  }

  test('impostor reveal, the eliminated card flipping', async ({ page }) => {
    await serveMatch(page, revealed(zorro, true));
    await midFlip(page, 'impostor-reveal-flip');
  });

  test('wavelength reveal, the target flipping and the scores counting', async ({ page }) => {
    await serveWavelength(page, wavelengthRevealed());
    await midFlip(page, 'wavelength-reveal-flip');
    await page.getByRole('list', { name: 'Puntaje' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1100);
    await snap(page, 'wavelength-reveal-counting');
  });

  test('just one reveal, the word flipping', async ({ page }) => {
    await serveJustOne(page, joRevealed('CORRECT'), null, { hostId: zorro });
    await midFlip(page, 'justone-reveal-flip');
  });

  test('la manada reveal, the cow moving to its new holder', async ({ page }) => {
    await serveManada(
      page,
      mmRevealed(['Plátano', 'plátanos', 'Plátano', 'el plátano', 'Mango']),
      null,
      { hostId: zorro },
    );
    const cow = page.getByRole('region', { name: 'La vaca rosa' });
    await cow.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    await snap(page, 'manada-cow-moving');
  });

  test('impostor final, the points counting', async ({ page }) => {
    await serveMatch(page, civiliansWin());
    await page.getByRole('list', { name: 'Puntos para la noche' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1300);
    await snap(page, 'impostor-final-counting');
  });
});
