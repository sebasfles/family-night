import { join } from 'node:path';
import type { RoomMember, RoomSnapshot } from '@family-night/shared';
import { expect, type Page, test } from '@playwright/test';

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

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    roomCode: 'KXPR',
    version: 7,
    hostId: me.playerId,
    members: [member(me.playerId, me.name)],
    currentMatch: null,
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
  await expect(page.getByText('El host elegirá el juego.')).toBeVisible();
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
