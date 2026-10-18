import { describe, expect, test } from 'vitest';
import { normalizePlayerName, playerNameKey } from './players.ts';

describe('normalizePlayerName', () => {
  test('trims and collapses inner spaces', () => {
    expect(normalizePlayerName('  Tía   Marta \t Pérez ')).toBe('Tía Marta Pérez');
  });

  test('composes accents so the same name typed two ways is one name', () => {
    expect(normalizePlayerName('Téo')).toBe('Téo');
  });

  test.each([
    ['A', null],
    ['  A  ', null],
    ['Ab', 'Ab'],
    ['a'.repeat(20), 'a'.repeat(20)],
    ['a'.repeat(21), null],
    ['ñandú veloz y feliz', 'ñandú veloz y feliz'],
    ['Abu\u0007', null],
    ['🦊🦊', '🦊🦊'],
  ])('%j becomes %j', (raw, expected) => {
    expect(normalizePlayerName(raw)).toBe(expected);
  });
});

describe('playerNameKey', () => {
  test('ignores case and accents', () => {
    expect(playerNameKey('Cóndor Veloz')).toBe(playerNameKey('condor VELOZ'));
    expect(playerNameKey('Ñandú')).toBe(playerNameKey('ñandu'));
  });

  test('keeps ñ apart from n, as Spanish does', () => {
    expect(playerNameKey('Ñandú')).not.toBe(playerNameKey('Nandu'));
  });
});
