import { z } from 'zod';
import { WAVELENGTH_MAX_CYCLES } from './constants.ts';
import type { ImpostorConfig, WavelengthConfig } from './domain.ts';

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

export const wavelengthConfigSchema = z.strictObject({
  cycles: z.int().min(1).max(WAVELENGTH_MAX_CYCLES),
}) satisfies z.ZodType<WavelengthConfig>;
