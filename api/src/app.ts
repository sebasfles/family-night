import type { HealthResponse } from '@family-night/shared';
import { Hono } from 'hono';
import { version } from './version.ts';

export const app = new Hono();

app.get('/api/health', (c) => c.json<HealthResponse>({ ok: true, version }));
