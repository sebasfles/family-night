import { PLAYER_NAME_MAX, PLAYER_NAME_MIN } from './constants.ts';

const HIDDEN = /\p{Cc}|(?!\u200D)\p{Cf}|[\u115F\u1160\u2800\u3164\uFFA0]/u;
const BLANK_GRAPHEME = /^[\p{M}\u200D]+$/u;

export function normalizePlayerName(raw: string): string | null {
  const name = raw.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (HIDDEN.test(name)) return null;
  const graphemes = Array.from(new Intl.Segmenter('es').segment(name), (part) => part.segment);
  if (graphemes.some((grapheme) => BLANK_GRAPHEME.test(grapheme))) return null;
  const length = graphemes.length;
  return length < PLAYER_NAME_MIN || length > PLAYER_NAME_MAX ? null : name;
}

export function playerNameKey(name: string): string {
  return name
    .normalize('NFC')
    .toLocaleLowerCase('es')
    .split('ñ')
    .map((part) => part.normalize('NFD').replace(/\p{M}/gu, ''))
    .join('ñ');
}
