import { formatCountdown, formatTime, humanDate, msUntil, todayKey } from '../src/lib/dates';

describe('todayKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 8, 10, 15, 0))).toBe('2026-09-10');
  });

  it('zero-pads month and day', () => {
    expect(todayKey(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});

describe('formatTime', () => {
  it('formats an early morning time', () => {
    expect(formatTime(new Date(2026, 0, 1, 5, 4))).toBe('5:04 AM');
  });

  it('formats noon and midnight', () => {
    expect(formatTime(new Date(2026, 0, 1, 12, 0))).toBe('12:00 PM');
    expect(formatTime(new Date(2026, 0, 1, 0, 30))).toBe('12:30 AM');
  });

  it('formats an evening time', () => {
    expect(formatTime(new Date(2026, 0, 1, 19, 9))).toBe('7:09 PM');
  });
});

describe('formatCountdown', () => {
  it('renders hours and minutes', () => {
    expect(formatCountdown(2 * 3_600_000 + 5 * 60_000)).toBe('2h 05m');
  });

  it('renders minutes and seconds', () => {
    expect(formatCountdown(3 * 60_000 + 4_000)).toBe('3m 04s');
  });

  it('renders seconds only', () => {
    expect(formatCountdown(9_000)).toBe('9s');
  });

  it('clamps negative input to zero', () => {
    expect(formatCountdown(-5_000)).toBe('0s');
  });
});

describe('humanDate', () => {
  it('formats weekday, day and short month', () => {
    expect(humanDate(new Date(2026, 8, 10))).toBe('Thursday, 10 Sep');
  });
});

describe('msUntil', () => {
  it('returns the signed distance from a reference time', () => {
    const from = new Date(2026, 8, 10, 12, 0, 0).getTime();
    expect(msUntil(new Date(2026, 8, 10, 12, 1, 0), from)).toBe(60_000);
    expect(msUntil(new Date(2026, 8, 10, 11, 59, 0), from)).toBe(-60_000);
  });
});
