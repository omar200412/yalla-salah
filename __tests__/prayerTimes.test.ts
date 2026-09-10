import { computeTimes } from '../src/services/prayerTimes';
import { PRAYER_KEYS } from '../src/types';

// Cairo — matches the app's default city / method.
const BASE = {
  lat: 30.0444,
  lng: 31.2357,
  methodKey: 'Egyptian' as const,
  madhab: 'shafi' as const,
};

const MIDDAY = new Date(2026, 8, 10, 12, 0, 0);

describe('computeTimes', () => {
  it('returns five strictly increasing prayer times', () => {
    const { times } = computeTimes({ ...BASE, date: MIDDAY });
    const ordered = PRAYER_KEYS.map((k) => times[k].getTime());
    for (let i = 1; i < ordered.length; i += 1) {
      expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
    }
  });

  it('reports the active window as the most recently started prayer', () => {
    const { times } = computeTimes({ ...BASE, date: MIDDAY });
    const justAfterDhuhr = new Date(times.dhuhr.getTime() + 60_000);
    expect(computeTimes({ ...BASE, date: justAfterDhuhr }).currentKey).toBe('dhuhr');

    const justAfterAsr = new Date(times.asr.getTime() + 60_000);
    expect(computeTimes({ ...BASE, date: justAfterAsr }).currentKey).toBe('asr');
  });

  it('carries the window over to Isha between midnight and Fajr', () => {
    const { times } = computeTimes({ ...BASE, date: MIDDAY });
    const beforeFajr = new Date(times.fajr.getTime() - 60 * 60_000);
    expect(computeTimes({ ...BASE, date: beforeFajr }).currentKey).toBe('isha');
  });

  it('points "next" at a strictly future time', () => {
    const result = computeTimes({ ...BASE, date: MIDDAY });
    expect(result.next).not.toBeNull();
    expect(result.next!.at.getTime()).toBeGreaterThan(MIDDAY.getTime());
  });

  it('rolls "next" over to tomorrow\'s Fajr after Isha', () => {
    const { times } = computeTimes({ ...BASE, date: MIDDAY });
    const afterIsha = new Date(times.isha.getTime() + 60_000);
    const result = computeTimes({ ...BASE, date: afterIsha });
    expect(result.next!.key).toBe('fajr');
    expect(result.next!.at.getTime()).toBeGreaterThan(afterIsha.getTime());
  });

  it('shifts Asr later under the Hanafi madhab', () => {
    const shafi = computeTimes({ ...BASE, madhab: 'shafi', date: MIDDAY });
    const hanafi = computeTimes({ ...BASE, madhab: 'hanafi', date: MIDDAY });
    expect(hanafi.times.asr.getTime()).toBeGreaterThan(shafi.times.asr.getTime());
  });
});
