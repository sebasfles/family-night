import type { HealthResponse } from '@family-night/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { makeRouter } from '../router';

function renderHome() {
  const queryClient = new QueryClient();
  const router = makeRouter(queryClient, createMemoryHistory({ initialEntries: ['/'] }));
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test('home shows the title and the version the server reports', async () => {
  const health: HealthResponse = { ok: true, version: 'abc1234' };
  const fetchMock = vi.fn(() => Promise.resolve(Response.json(health)));
  vi.stubGlobal('fetch', fetchMock);

  renderHome();

  expect(await screen.findByRole('heading', { name: 'Noche de juegos' })).toBeVisible();
  expect(await screen.findByText('En línea, versión abc1234')).toBeVisible();
  expect(fetchMock).toHaveBeenCalledWith('/api/health');
});

test('home says so when the server does not answer', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))),
  );

  renderHome();

  expect(await screen.findByText('El servidor no responde')).toBeVisible();
});
