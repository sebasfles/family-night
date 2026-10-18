import { handle } from '@hono/aws-lambda';
import { createApp } from './app.ts';
import { depsFromEnv } from './deps.ts';

export const handler = handle(createApp(depsFromEnv()));
