import { generateCode, isValidCode, normalizeCode } from '../src/lib/code';

describe('generateCode', () => {
  it('always returns exactly 6 digits', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateCode()).toMatch(/^[0-9]{6}$/);
    }
  });
});

describe('isValidCode', () => {
  it('accepts 6 digits, with or without surrounding whitespace', () => {
    expect(isValidCode('123456')).toBe(true);
    expect(isValidCode('  654321  ')).toBe(true);
  });

  it('rejects wrong lengths and non-digits', () => {
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('1234567')).toBe(false);
    expect(isValidCode('abcdef')).toBe(false);
    expect(isValidCode('12 34 56')).toBe(false);
  });
});

describe('normalizeCode', () => {
  it('strips non-digits and caps at 6 characters', () => {
    expect(normalizeCode('12-34-56')).toBe('123456');
    expect(normalizeCode('ab12cd34ef56gh78')).toBe('123456');
    expect(normalizeCode('99')).toBe('99');
  });
});
