import { z } from 'zod';
import type { ImpostorConfig } from './domain.ts';

export const impostorConfigSchema = z.strictObject({
  impostorCount: z.int().min(1).max(3),
  randomOrder: z.boolean(),
  tieRule: z.enum(['SKIP', 'RANDOM']),
  showCategoryToImpostor: z.boolean(),
  categories: z
    .array(z.string().min(1).max(40))
    .min(1)
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length),
  impostorLastGuess: z.boolean(),
}) satisfies z.ZodType<ImpostorConfig>;
