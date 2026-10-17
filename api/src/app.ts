import type { HealthResponse } from '@family-night/shared';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Deps } from './deps.ts';
import type { AppEnv } from './handlers/context.ts';
import { playersRoutes } from './handlers/players.ts';
import { roomsRoutes } from './handlers/rooms.ts';
import { AppError } from './lib/errors.ts';
import { describeError, log } from './lib/log.ts';
import type { PlayerItem } from './repos/players.ts';
import { version } from './version.ts';

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.use(async (c, next) => {
    const started = Date.now();
    await next();
    const player = c.get('player') as PlayerItem | undefined;
    log.info('request', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Date.now() - started,
      playerId: player?.playerId,
    });
  });

  app.get('/api/health', (c) => c.json<HealthResponse>({ ok: true, version }));
  app.route('/api/players', playersRoutes(deps));
  app.route('/api/rooms', roomsRoutes(deps));

  app.notFound((c) => c.json(new AppError('NOT_FOUND').toBody(), 404));

  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json(error.toBody(), error.status as ContentfulStatusCode);
    }
    log.error('unhandled error', { path: c.req.path, ...describeError(error) });
    return c.json(new AppError('INTERNAL_ERROR').toBody(), 500);
  });

  return app;
}
