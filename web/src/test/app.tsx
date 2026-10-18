import {
  IMPOSTOR_DEFAULTS,
  JUST_ONE_DEFAULTS,
  WAVELENGTH_DEFAULTS,
  type RoomMember,
  type RoomSnapshot,
} from '@family-night/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { saveIdentity, type Identity } from '../identity/storage';
import { makeRouter } from '../router';

export const me: Identity = {
  playerId: '11111111-1111-4111-8111-111111111111',
  playerToken: 'token-of-me',
  name: 'Cóndor Veloz',
};

export type Handler = (init: RequestInit) => Response | Promise<Response>;

export interface ApiMock {
  calls: { route: string; init: RequestInit }[];
  on: (route: string, handler: Handler) => void;
}

export function mockApi(handlers: Record<string, Handler> = {}): ApiMock {
  const routes = new Map(Object.entries(handlers));
  const calls: ApiMock['calls'] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string, init: RequestInit = {}) => {
      const route = `${init.method ?? 'GET'} ${input}`;
      calls.push({ route, init });
      const handler = routes.get(route);
      return handler
        ? Promise.resolve(handler(init))
        : Promise.resolve(
            Response.json(
              { error: { code: 'NOT_FOUND', message: `no mock for ${route}` } },
              { status: 404 },
            ),
          );
    }),
  );
  return { calls, on: (route, handler) => routes.set(route, handler) };
}

export function apiError(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status });
}

export function member(overrides: Partial<RoomMember> & { playerId: string }): RoomMember {
  const now = new Date().toISOString();
  return {
    name: 'Zorro Astuto',
    online: true,
    lastSeenAt: now,
    totalScore: 0,
    joinedAt: now,
    ...overrides,
  };
}

export function snapshot(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    roomCode: 'ABCD',
    version: 3,
    hostId: me.playerId,
    members: [member({ playerId: me.playerId, name: me.name })],
    currentMatch: null,
    selectedGame: 'IMPOSTOR',
    configs: {
      IMPOSTOR: { ...IMPOSTOR_DEFAULTS, categories: ['animales'] },
      WAVELENGTH: { ...WAVELENGTH_DEFAULTS },
      JUST_ONE: { ...JUST_ONE_DEFAULTS },
    },
    serverTime: new Date().toISOString(),
    ...overrides,
  };
}

export function signIn(identity: Identity = me): void {
  saveIdentity(identity);
}

export function renderApp(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const router = makeRouter(queryClient, createMemoryHistory({ initialEntries: [path] }));
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}
