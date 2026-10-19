import { z } from 'zod';
import {
  JUST_ONE_MAX_CYCLES,
  MANADA_MAX_ROUNDS,
  MANADA_MIN_ROUNDS,
  WAVELENGTH_MAX_CYCLES,
} from './constants.ts';
import type { ImpostorConfig, JustOneConfig, ManadaConfig, WavelengthConfig } from './domain.ts';

function withoutRemovedKeys(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null || !('impostorLastGuess' in raw)) return raw;
  return Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'impostorLastGuess'));
}

export const impostorConfigSchema = z.preprocess(
  withoutRemovedKeys,
  z.strictObject({
    impostorCount: z.int().min(1).max(3),
    randomOrder: z.boolean(),
    tieRule: z.enum(['SKIP', 'RANDOM']),
    showCategoryToImpostor: z.boolean(),
    categories: z
      .array(z.string().min(1).max(40))
      .min(1)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length),
  }),
) satisfies z.ZodType<ImpostorConfig>;

export const wavelengthConfigSchema = z.strictObject({
  cycles: z.int().min(1).max(WAVELENGTH_MAX_CYCLES),
}) satisfies z.ZodType<WavelengthConfig>;

export const justOneConfigSchema = z.strictObject({
  cycles: z.int().min(1).max(JUST_ONE_MAX_CYCLES),
}) satisfies z.ZodType<JustOneConfig>;

export const manadaConfigSchema = z.strictObject({
  goal: z.enum(['ROUNDS', 'POINTS']),
  rounds: z.int().min(MANADA_MIN_ROUNDS).max(MANADA_MAX_ROUNDS),
}) satisfies z.ZodType<ManadaConfig>;
