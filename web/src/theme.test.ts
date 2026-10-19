import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'index.css'), 'utf8');

type Rgb = [number, number, number];

const tokens = new Map(
  Array.from(css.matchAll(/--color-([\w-]+):\s*#([0-9a-f]{6});/gi), ([, name, hex]) => [
    name ?? '',
    hex ?? '',
  ]),
);

function color(name: string): Rgb {
  const hex = tokens.get(name);
  if (!hex) throw new Error(`no --color-${name} in index.css`);
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16)) as Rgb;
}

function over(top: Rgb, alpha: number, bottom: Rgb): Rgb {
  return top.map((channel, i) => channel * alpha + (bottom[i] ?? 0) * (1 - alpha)) as Rgb;
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const surfaces = ['night', 'night-soft', 'night-raised'];

describe('palette', () => {
  test('the background is warm, not blue', () => {
    for (const name of surfaces) {
      const [r, , b] = color(name);
      expect(r, name).toBeGreaterThan(b);
    }
  });

  test.each(surfaces)('body text and muted text read on %s', (surface) => {
    expect(contrast(color('cream'), color(surface))).toBeGreaterThanOrEqual(7);
    expect(
      contrast(over(color('cream'), 0.6, color(surface)), color(surface)),
    ).toBeGreaterThanOrEqual(4.5);
  });

  test.each([
    ['night', 'moon'],
    ['night', 'moon-bright'],
    ['night', 'ember'],
    ['cream', 'night-raised'],
    ['moon', 'night-soft'],
    ['ember', 'night-raised'],
    ['sage', 'night-soft'],
    ['lagoon', 'night-soft'],
    ['orchid', 'night-soft'],
  ])('%s text on %s passes AA', (text, background) => {
    expect(contrast(color(text), color(background))).toBeGreaterThanOrEqual(4.5);
  });
});
