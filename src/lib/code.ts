import { ROOM_CODE_LENGTH } from '../config/constants';

/** Random 6-digit room code as a string, e.g. `"048213"`. */
export function generateCode(): string {
  const min = 10 ** (ROOM_CODE_LENGTH - 1); // 100000
  const max = 10 ** ROOM_CODE_LENGTH; // 1000000
  return String(Math.floor(min + Math.random() * (max - min)));
}

/** True when `input` is exactly 6 digits (whitespace trimmed). */
export function isValidCode(input: string): boolean {
  return new RegExp(`^[0-9]{${ROOM_CODE_LENGTH}}$`).test(input.trim());
}

/** Strip everything but digits and cap at the code length. */
export function normalizeCode(input: string): string {
  return input.replace(/[^0-9]/g, '').slice(0, ROOM_CODE_LENGTH);
}
