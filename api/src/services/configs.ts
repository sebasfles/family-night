import type { GameConfigs } from '@family-night/shared';
import { defaultImpostorConfig } from './impostor/words.ts';

export function resolveConfigs(stored: Partial<GameConfigs>): GameConfigs {
  return { IMPOSTOR: stored.IMPOSTOR ?? defaultImpostorConfig() };
}
