import { randomBytes } from 'node:crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const ulidPattern = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function ulid(nowMs: number): string {
  let time = '';
  for (let rest = nowMs, i = 0; i < 10; i++, rest = Math.floor(rest / 32)) {
    time = (ALPHABET[rest % 32] ?? '0') + time;
  }
  const random = Array.from(randomBytes(16), (byte) => ALPHABET[byte % 32] ?? '0').join('');
  return time + random;
}
