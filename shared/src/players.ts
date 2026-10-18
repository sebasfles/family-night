import { PLAYER_NAME_MAX, PLAYER_NAME_MIN } from './constants.ts';

export function normalizePlayerName(raw: string): string | null {
  const name = raw.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const length = Array.from(new Intl.Segmenter('es').segment(name)).length;
  if (length < PLAYER_NAME_MIN || length > PLAYER_NAME_MAX || /\p{Cc}/u.test(name)) return null;
  return name;
}

export function playerNameKey(name: string): string {
  return name
    .normalize('NFC')
    .toLocaleLowerCase('es')
    .split('ñ')
    .map((part) => part.normalize('NFD').replace(/\p{M}/gu, ''))
    .join('ñ');
}
