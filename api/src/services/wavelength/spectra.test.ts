import { describe, expect, test } from 'vitest';
import bank from '../../data/wavelength-spectra.json' with { type: 'json' };

function normalized(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

describe('wavelength-spectra.json', () => {
  test('has about 150 pairs with unique stable ids', () => {
    expect(bank.spectra.length).toBeGreaterThanOrEqual(140);
    const ids = bank.spectra.map((spectrum) => spectrum.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+\.[a-z0-9-]+$/);
  });

  test('every pair has two different ends short enough for a phone dial', () => {
    for (const { left, right } of bank.spectra) {
      expect(left.trim(), right).not.toBe('');
      expect(right.trim(), left).not.toBe('');
      expect(normalized(left)).not.toBe(normalized(right));
      expect(left.length, left).toBeLessThanOrEqual(28);
      expect(right.length, right).toBeLessThanOrEqual(28);
    }
  });

  test('no pair appears twice, in either direction', () => {
    const keys = bank.spectra.map((s) =>
      [normalized(s.left), normalized(s.right)].sort().join('|'),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});
