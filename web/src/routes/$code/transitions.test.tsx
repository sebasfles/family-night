import type { ImpostorPublic, RoomSnapshot } from '@family-night/shared';
import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { applyRoom } from '../../api/room';
import { me, member, mockApi, renderApp, signIn, snapshot } from '../../test/app';
import { impostorMatch, MATCH_ID } from '../../test/impostor-match';
import { stubReducedMotion } from '../../test/motion';

const everyone = [
  member({ playerId: me.playerId, name: me.name }),
  member({ playerId: '22222222-2222-4222-8222-222222222222', name: 'Zorro Astuto' }),
  member({ playerId: '33333333-3333-4333-8333-333333333333', name: 'Oso Sabio' }),
];
const ids = everyone.map((m) => m.playerId);

const voting = impostorMatch(ids);
const tied = impostorMatch(ids, {
  phase: 'REVEAL',
  votedPlayerIds: ids,
  lastResult: {
    round: 1,
    tally: ids.map((playerId) => ({ playerId, votes: 1 })),
    tie: true,
    eliminatedId: null,
  },
});

function room(match: ImpostorPublic | null, version = 3): RoomSnapshot {
  return snapshot({ members: everyone, currentMatch: match, version });
}

function open(served: RoomSnapshot) {
  signIn();
  mockApi({
    'GET /api/players/me': () => Response.json({ playerId: me.playerId, name: me.name }),
    'POST /api/rooms/ABCD/join': () => Response.json({ room: served }),
    'GET /api/rooms/ABCD': () => Response.json({ room: served }),
    [`GET /api/rooms/ABCD/matches/${MATCH_ID}/me`]: () => Response.json({ secret: null }),
    'GET /api/words/categories': () => Response.json({ categories: [] }),
  });
  return renderApp('/ABCD');
}

function entering(element: HTMLElement): boolean {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    if (node.style.opacity !== '' && Number(node.style.opacity) < 1) return true;
  }
  return false;
}

async function settled(element: HTMLElement) {
  await waitFor(() => {
    expect(entering(element)).toBe(false);
  });
}

describe.each([
  { reduce: false, expected: true, label: 'animates' },
  { reduce: true, expected: false, label: 'does not animate with reduced motion' },
])('a screen change $label', ({ reduce, expected }) => {
  test('from one phase to the next', async () => {
    stubReducedMotion(reduce);
    const { queryClient } = open(room(voting));
    await settled(await screen.findByRole('heading', { name: '¿Quién es el impostor?' }));

    act(() => {
      applyRoom(queryClient, room(tied, 4));
    });

    const reveal = await screen.findByRole('heading', { name: 'Empate: nadie es eliminado' });
    expect(entering(reveal)).toBe(expected);
  });

  test('from the lobby to the game', async () => {
    stubReducedMotion(reduce);
    const { queryClient, router } = open(room(null));
    await settled(await screen.findByRole('heading', { name: 'Jugadores' }));

    act(() => {
      applyRoom(queryClient, room(voting, 4));
    });

    const header = await screen.findByRole('heading', { name: 'Ronda 1' });
    expect(router.state.location.pathname).toBe('/ABCD/impostor');
    expect(entering(header)).toBe(expected);
  });
});
