import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@family-night/shared';

export const ROOM_CODE_ATTEMPTS = 10;

export function randomRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET.charAt(Math.floor(random() * ROOM_CODE_ALPHABET.length));
  }
  return code;
}
