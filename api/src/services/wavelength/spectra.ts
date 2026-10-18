import type { Spectrum } from '@family-night/shared';
import bank from '../../data/wavelength-spectra.json' with { type: 'json' };

export const spectraBank: Spectrum[] = bank.spectra;
