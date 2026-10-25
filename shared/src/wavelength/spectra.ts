import type { Spectrum } from '../domain.ts';
import bank from './spectra.json' with { type: 'json' };

export const spectraBank: readonly Spectrum[] = bank.spectra;
