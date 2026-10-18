import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { depsFromEnv } from './deps.ts';

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: createApp(depsFromEnv()).fetch, port }, (info) => {
  console.log(`api listening on http://localhost:${String(info.port)}`);
});
