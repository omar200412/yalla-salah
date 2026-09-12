# Hijri date, Jum'ah, weekly/monthly reports, and Arabic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Hijri date line, Friday's Jum'ah label, a weekly stats view, a monthly report, and a full Arabic translation with native RTL to Yalla Salah, shipped together as v1.2.0.

**Architecture:** New pure-logic modules (no React/RN imports, unit-tested directly) for Hijri conversion, digit localization, Jum'ah labeling, stats aggregation, and the RTL-switch decision. A hand-written `en`/`ar` string table with a `useT()` hook. Two new full-screen report modals reached from Settings, backed by a live Firestore range query. A Firestore rules change adds a day-level edit window and a `list` permission for that query.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript, Firebase JS SDK v11 (Firestore `onSnapshot`/`query`/`where`/`documentId`), `adhan` v4 (unchanged), `ts-jest`.

## Global Constraints

- No new npm dependencies — no i18n library, no date library. Everything is hand-written pure TypeScript, matching the existing `dates.ts`/`layout.ts` style (dependency-free, unit-tested).
- Every new pure module goes in `src/lib/` with zero React/React Native imports, so it is testable directly under `ts-jest`.
- The room code (6 digits) is always Western digits, everywhere, in both languages.
- Arabic tone: standard Arabic (فصحى) for buttons/settings/errors; colloquial touches only for the brand name and short encouragements.
- A missing Arabic translation key must fail `tsc --noEmit`, not show blank text at runtime — `ar` is typed as `typeof en`.
- Firestore rules changes must be verified by actually running `npm run deploy:rules` against the live `yalla-salah` project (this repo has no local emulator setup) — a syntax error surfaces there, not before.
- Every task that touches `.tsx` must end with `npm run typecheck` passing.
- Version bumps to 1.2.0 happen once, in the rollout task — don't bump per-task.

---

## Task 1: Day-key helpers in `dates.ts`

**Files:**
- Modify: `src/lib/dates.ts`
- Test: `__tests__/dates.test.ts`

**Interfaces:**
- Produces: `dayKeyParts(dayKey: string): { y: number; m: number; d: number }`, `isWithinEditWindow(dayKey: string, today?: string): boolean`, `addDays(dayKey: string, delta: number): string`. Also extends `formatTime`, `formatCountdown`, and `humanDate` with an optional `lang: 'en'|'ar'` parameter (Step 5 below). Used by Task 8 (`useRoomSync.ts`), Tasks 10–12 (screen translation), and Tasks 15–17 (report screens).

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/dates.test.ts`:

```ts
import { addDays, dayKeyParts, isWithinEditWindow, todayKey } from '../src/lib/dates';

describe('dayKeyParts', () => {
  it('splits a day key into numeric year, month, day', () => {
    expect(dayKeyParts('2026-09-12')).toEqual({ y: 2026, m: 9, d: 12 });
  });

  it('handles the first day of the year', () => {
    expect(dayKeyParts('2026-01-01')).toEqual({ y: 2026, m: 1, d: 1 });
  });
});

describe('isWithinEditWindow', () => {
  const today = '2026-09-12';

  it('accepts today', () => {
    expect(isWithinEditWindow('2026-09-12', today)).toBe(true);
  });

  it('accepts exactly 6 days ago (the 7th day of the window)', () => {
    expect(isWithinEditWindow('2026-09-06', today)).toBe(true);
  });

  it('rejects 7 days ago', () => {
    expect(isWithinEditWindow('2026-09-05', today)).toBe(false);
  });

  it('rejects a future day', () => {
    expect(isWithinEditWindow('2026-09-13', today)).toBe(false);
  });

  it('defaults `today` to the real current date', () => {
    expect(isWithinEditWindow(todayKey())).toBe(true);
  });
});

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-09-12', 3)).toBe('2026-09-15');
  });

  it('subtracts days across a month boundary', () => {
    expect(addDays('2026-09-03', -5)).toBe('2026-08-29');
  });

  it('handles a zero delta', () => {
    expect(addDays('2026-09-12', 0)).toBe('2026-09-12');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- dates.test.ts`
Expected: FAIL — `dayKeyParts` / `isWithinEditWindow` are not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/dates.ts` (after `msUntil`):

```ts
/** Splits a `YYYY-MM-DD` key into its numeric parts. */
export function dayKeyParts(dayKey: string): { y: number; m: number; d: number } {
  const [y, m, d] = dayKey.split('-').map(Number);
  return { y, m, d };
}

/**
 * True when `dayKey` is today or one of the 6 days before it (7 days total) —
 * the window in which a forgotten prayer mark can still be fixed. Compares
 * calendar dates, not raw strings, so it is correct across month/year
 * boundaries.
 */
export function isWithinEditWindow(dayKey: string, today: string = todayKey()): boolean {
  const a = dayKeyParts(dayKey);
  const b = dayKeyParts(today);
  const dayMs = new Date(a.y, a.m - 1, a.d).getTime();
  const todayMs = new Date(b.y, b.m - 1, b.d).getTime();
  const diffDays = Math.round((todayMs - dayMs) / 86_400_000);
  return diffDays >= 0 && diffDays <= 6;
}

/** Adds (or, for a negative `delta`, subtracts) whole days to a `YYYY-MM-DD` key. */
export function addDays(dayKey: string, delta: number): string {
  const { y, m, d } = dayKeyParts(dayKey);
  return todayKey(new Date(y, m - 1, d + delta));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- dates.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing tests for Arabic-aware formatting**

`formatTime`, `humanDate`, and `formatCountdown` need an optional `lang` parameter for Arabic mode (Arabic meridiem/weekday/month names and time-unit letters — digit localization itself is a separate, later step via `toArabicDigits`, so these still produce Western digits). Add to `__tests__/dates.test.ts`, inside the existing `describe('formatTime', ...)`, `describe('formatCountdown', ...)`, and `describe('humanDate', ...)` blocks respectively:

```ts
  it('formats with Arabic meridiem markers', () => {
    expect(formatTime(new Date(2026, 0, 1, 5, 4), 'ar')).toBe('5:04 ص');
    expect(formatTime(new Date(2026, 0, 1, 19, 9), 'ar')).toBe('7:09 م');
  });
```

```ts
  it('renders Arabic time-unit letters', () => {
    expect(formatCountdown(2 * 3_600_000 + 5 * 60_000, 'ar')).toBe('2س 05د');
    expect(formatCountdown(3 * 60_000 + 4_000, 'ar')).toBe('3د 04ث');
    expect(formatCountdown(9_000, 'ar')).toBe('9ث');
  });
```

```ts
  it('formats the weekday and month in Arabic', () => {
    expect(humanDate(new Date(2026, 8, 12), 'ar')).toBe('السبت، 12 سبتمبر');
  });
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npm test -- dates.test.ts`
Expected: FAIL — `formatTime`/`formatCountdown`/`humanDate` don't yet accept a second argument (existing calls still pass; only the new assertions fail).

- [ ] **Step 7: Implement the `lang` parameter**

In `src/lib/dates.ts`, add after `MONTHS_SHORT`:

```ts
const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const MONTHS_SHORT_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
```

Replace `formatTime`:

```ts
/** e.g. `5:04 AM` / `5:04 ص`. Always Western digits — see toArabicDigits. */
export function formatTime(d: Date, lang: 'en' | 'ar' = 'en'): string {
  let h = d.getHours();
  const m = d.getMinutes();
  const isPm = h >= 12;
  h = h % 12;
  if (h === 0) h = 12;
  const suffix = lang === 'ar' ? (isPm ? 'م' : 'ص') : isPm ? 'PM' : 'AM';
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}
```

Replace `formatCountdown`:

```ts
/** e.g. `2h 05m` / `2س 05د`. Negative input clamps to `0s`/`0ث`. */
export function formatCountdown(ms: number, lang: 'en' | 'ar' = 'en'): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const units = lang === 'ar' ? { h: 'س', m: 'د', s: 'ث' } : { h: 'h', m: 'm', s: 's' };
  if (h > 0) return `${h}${units.h} ${String(m).padStart(2, '0')}${units.m}`;
  if (m > 0) return `${m}${units.m} ${String(s).padStart(2, '0')}${units.s}`;
  return `${s}${units.s}`;
}
```

Replace `humanDate`:

```ts
/** e.g. `Thursday, 10 Sep` / `الخميس، 10 سبتمبر`. */
export function humanDate(d: Date = new Date(), lang: 'en' | 'ar' = 'en'): string {
  if (lang === 'ar') {
    return `${WEEKDAYS_AR[d.getDay()]}، ${d.getDate()} ${MONTHS_SHORT_AR[d.getMonth()]}`;
  }
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- dates.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/dates.ts __tests__/dates.test.ts
git commit -m "feat(dates): add dayKeyParts, isWithinEditWindow, and Arabic-aware formatting

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `digits.ts` and `prayers.ts`

**Files:**
- Create: `src/lib/digits.ts`
- Create: `src/lib/prayers.ts`
- Test: `__tests__/digits.test.ts`
- Test: `__tests__/prayers.test.ts`

**Interfaces:**
- Consumes: `PRAYERS`, `PrayerInfo`, `PRAYER_KEYS` from `src/types/index.ts` (unchanged, already defined).
- Produces: `toArabicDigits(input: string): string`; `prayersFor(date: Date): PrayerInfo[]` (same shape as `PRAYERS`, with Friday's `dhuhr` entry relabelled). Used by Tasks 11, 12, 16, 17 (digits) and Tasks 11, 12, 16, 17 (prayers).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/digits.test.ts`:

```ts
import { toArabicDigits } from '../src/lib/digits';

describe('toArabicDigits', () => {
  it('maps each Western digit to its Arabic-Indic equivalent', () => {
    expect(toArabicDigits('0123456789')).toBe('٠١٢٣٤٥٦٧٨٩');
  });

  it('leaves non-digit characters untouched', () => {
    expect(toArabicDigits('5:04 AM')).toBe('٥:٠٤ AM');
  });

  it('handles an empty string', () => {
    expect(toArabicDigits('')).toBe('');
  });
});
```

Create `__tests__/prayers.test.ts`:

```ts
import { prayersFor } from '../src/lib/prayers';
import { PRAYERS } from '../src/types';

describe('prayersFor', () => {
  it('returns the standard list on a non-Friday', () => {
    const thursday = new Date(2026, 8, 10); // 10 Sep 2026 is a Thursday
    expect(prayersFor(thursday)).toEqual(PRAYERS);
  });

  it('relabels Dhuhr as Jum\'ah on a Friday, key unchanged', () => {
    const friday = new Date(2026, 8, 11); // 11 Sep 2026 is a Friday
    const result = prayersFor(friday);
    const dhuhr = result.find((p) => p.key === 'dhuhr')!;
    expect(dhuhr.en).toBe("Jum'ah");
    expect(dhuhr.ar).toBe('الجمعة');
    expect(dhuhr.short).toBe("Jum'ah");
  });

  it('only changes the dhuhr entry on Friday, others unchanged', () => {
    const friday = new Date(2026, 8, 11);
    const result = prayersFor(friday);
    const others = result.filter((p) => p.key !== 'dhuhr');
    const originalOthers = PRAYERS.filter((p) => p.key !== 'dhuhr');
    expect(others).toEqual(originalOthers);
  });

  it('preserves prayer order', () => {
    const friday = new Date(2026, 8, 11);
    expect(prayersFor(friday).map((p) => p.key)).toEqual(
      PRAYERS.map((p) => p.key),
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- digits.test.ts prayers.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Create `src/lib/digits.ts`:

```ts
// Arabic-Indic digit localization — used only when the app is in Arabic mode.
// The room code is exempt everywhere; see the callers in the UI layer.

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Replaces every Western digit 0-9 in `input` with its Arabic-Indic form. */
export function toArabicDigits(input: string): string {
  return input.replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}
```

Create `src/lib/prayers.ts`:

```ts
import { PRAYERS, PrayerInfo } from '../types';

const JUMAH: PrayerInfo = { key: 'dhuhr', en: "Jum'ah", ar: 'الجمعة', short: "Jum'ah" };

/**
 * The five prayers for a given date, with Friday's Dhuhr entry relabelled
 * Jum'ah. The stored key is always `dhuhr` — only the display labels change.
 */
export function prayersFor(date: Date): PrayerInfo[] {
  const isFriday = date.getDay() === 5;
  if (!isFriday) return PRAYERS;
  return PRAYERS.map((p) => (p.key === 'dhuhr' ? JUMAH : p));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- digits.test.ts prayers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/digits.ts src/lib/prayers.ts __tests__/digits.test.ts __tests__/prayers.test.ts
git commit -m "feat: add Arabic-Indic digit mapping and Jum'ah prayer labeling

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Hijri calendar module

**Files:**
- Create: `scripts/generate-hijri-table.js`
- Create: `src/lib/hijriTable.ts` (generated output, committed like `src/lib/dates.ts` — not gitignored)
- Create: `src/lib/hijri.ts`
- Test: `__tests__/hijri.test.ts`

**Interfaces:**
- Produces: `toHijri(date: Date, offset?: number): HijriDate`, `formatHijri(h: HijriDate, lang: 'en'|'ar'): string`, `hijriMonthRange(year: number, month: number, offset?: number): { start: string; end: string }`, `type HijriDate = { year: number; month: number; day: number }`. Used by Task 10 (dashboard header) and Task 17 (monthly report).

- [ ] **Step 1: Write the generator script**

Create `scripts/generate-hijri-table.js`:

```js
#!/usr/bin/env node
// Generates src/lib/hijriTable.ts from Node's built-in ICU `islamic-umalqura`
// calendar. Run this once, offline (`node scripts/generate-hijri-table.js`) —
// it is a dev-time tool, not part of the app or the test suite. The app
// itself never calls Intl for this: Hermes on Android does not ship the
// full ICU calendar data this needs, so the result is baked into a table.
'use strict';

const fs = require('fs');
const path = require('path');

const START_YEAR = 1440; // 1 Muharram 1440 AH = 2018-09-11 Gregorian
const END_YEAR = 1500;
const DAY_MS = 86_400_000;

const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function hijriParts(ms) {
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(ms)).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );
  return { y: Number(parts.year.replace(/\D/g, '')), m: Number(parts.month), d: Number(parts.day) };
}

const monthStarts = [];
for (let ms = Date.UTC(2015, 0, 1); ms < Date.UTC(2085, 0, 1); ms += DAY_MS) {
  const { y, m, d } = hijriParts(ms);
  if (d === 1 && y >= START_YEAR && y <= END_YEAR) monthStarts.push({ y, m, ms });
}

if (monthStarts[0].y !== START_YEAR || monthStarts[0].m !== 1) {
  throw new Error(`Expected first entry ${START_YEAR}-01, got ${monthStarts[0].y}-${monthStarts[0].m}`);
}

const epochGregorian = new Date(monthStarts[0].ms).toISOString().slice(0, 10);

const lengths = [];
for (let i = 0; i < monthStarts.length - 1; i += 1) {
  const days = Math.round((monthStarts[i + 1].ms - monthStarts[i].ms) / DAY_MS);
  if (days !== 29 && days !== 30) {
    throw new Error(`Month ${monthStarts[i].y}-${monthStarts[i].m} has an unexpected length: ${days}`);
  }
  lengths.push(days);
}

let hex = '';
for (let i = 0; i < lengths.length; i += 4) {
  let nibble = 0;
  for (let bit = 0; bit < 4; bit += 1) {
    if (lengths[i + bit] === 30) nibble |= 1 << bit;
  }
  hex += nibble.toString(16);
}

const out = `// GENERATED by scripts/generate-hijri-table.js — do not hand-edit.
// Source: Node's built-in ICU islamic-umalqura calendar.

/** Gregorian date (YYYY-MM-DD) of 1 Muharram ${START_YEAR} AH. */
export const HIJRI_EPOCH_GREGORIAN = '${epochGregorian}';

/** First Hijri year encoded (index 0 of the table). */
export const HIJRI_TABLE_START_YEAR = ${START_YEAR};

/** Number of months encoded, in order starting at HIJRI_TABLE_START_YEAR-01. */
export const HIJRI_TABLE_MONTH_COUNT = ${lengths.length};

/**
 * One hex nibble per 4 months; bit N set means that month has 30 days
 * (clear means 29 days).
 */
export const HIJRI_MONTH_LENGTHS_HEX = '${hex}';
`;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'hijriTable.ts'), out);
console.log(`Wrote ${lengths.length} month lengths (${hex.length} hex chars).`);
console.log(`Epoch: ${epochGregorian} = 1 Muharram ${START_YEAR} AH`);
```

- [ ] **Step 2: Run the generator and verify its output**

Run: `node scripts/generate-hijri-table.js`
Expected: prints `Wrote 731 month lengths (183 hex chars).` and `Epoch: 2018-09-11 = 1 Muharram 1440 AH`, and creates `src/lib/hijriTable.ts`.

- [ ] **Step 3: Write the failing tests**

Create `__tests__/hijri.test.ts`:

```ts
import { formatHijri, hijriMonthRange, toHijri } from '../src/lib/hijri';
import { HIJRI_EPOCH_GREGORIAN, HIJRI_TABLE_MONTH_COUNT } from '../src/lib/hijriTable';

// Cross-checks every day the table covers against Node's own ICU calendar —
// this only runs in the dev/CI Node environment (which has full ICU data),
// the same source the table itself was generated from. The app never calls
// Intl for this at runtime; see src/lib/hijri.ts.
describe('toHijri — matches Node\'s ICU calendar across the whole table', () => {
  const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  it('agrees with Intl for every day from the epoch to the end of the table', () => {
    const [ey, em, ed] = HIJRI_EPOCH_GREGORIAN.split('-').map(Number);
    const start = Date.UTC(ey, em - 1, ed);
    const totalDays = 30 * (HIJRI_TABLE_MONTH_COUNT + 1); // generous upper bound
    let mismatches = 0;

    for (let i = 0; i < totalDays; i += 1) {
      const ms = start + i * 86_400_000;
      const expected = fmt.formatToParts(new Date(ms)).filter((p) => p.type !== 'literal');
      const expectedYear = Number(expected.find((p) => p.type === 'year')!.value.replace(/\D/g, ''));
      const expectedMonth = Number(expected.find((p) => p.type === 'month')!.value);
      const expectedDay = Number(expected.find((p) => p.type === 'day')!.value);
      if (expectedYear > 1500) break; // past the table's coverage

      const actual = toHijri(new Date(ms));
      if (actual.year !== expectedYear || actual.month !== expectedMonth || actual.day !== expectedDay) {
        mismatches += 1;
      }
    }
    expect(mismatches).toBe(0);
  });
});

describe('toHijri — fixed dates', () => {
  it('18 Feb 2026 is 1 Ramadan 1447', () => {
    expect(toHijri(new Date(2026, 1, 18))).toEqual({ year: 1447, month: 9, day: 1 });
  });

  it('12 Sep 2026 is 1 Rabi\' al-Thani 1448', () => {
    expect(toHijri(new Date(2026, 8, 12))).toEqual({ year: 1448, month: 4, day: 1 });
  });

  it('applies a positive day offset', () => {
    expect(toHijri(new Date(2026, 8, 12), 1)).toEqual({ year: 1448, month: 4, day: 2 });
  });

  it('applies a negative day offset', () => {
    expect(toHijri(new Date(2026, 8, 12), -1)).toEqual({ year: 1448, month: 3, day: 29 });
  });
});

describe('formatHijri', () => {
  it('formats in English with Western digits', () => {
    expect(formatHijri({ year: 1448, month: 4, day: 1 }, 'en')).toBe("1 Rabi' al-Thani 1448 AH");
  });

  it('formats in Arabic with Western digits (digit localization is a separate step)', () => {
    expect(formatHijri({ year: 1447, month: 9, day: 1 }, 'ar')).toBe('1 رمضان 1447 هـ');
  });
});

describe('hijriMonthRange', () => {
  it('returns the Gregorian range for Ramadan 1447', () => {
    expect(hijriMonthRange(1447, 9)).toEqual({ start: '2026-02-18', end: '2026-03-19' });
  });

  it('shifts by the day offset', () => {
    expect(hijriMonthRange(1447, 9, 1)).toEqual({ start: '2026-02-17', end: '2026-03-18' });
  });

  it('throws outside the table range', () => {
    expect(() => hijriMonthRange(1300, 1)).toThrow();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm test -- hijri.test.ts`
Expected: FAIL — `../src/lib/hijri` not found.

- [ ] **Step 5: Implement `src/lib/hijri.ts`**

```ts
import {
  HIJRI_EPOCH_GREGORIAN,
  HIJRI_MONTH_LENGTHS_HEX,
  HIJRI_TABLE_MONTH_COUNT,
  HIJRI_TABLE_START_YEAR,
} from './hijriTable';

export type HijriDate = { year: number; month: number; day: number };

const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];
const HIJRI_MONTHS_EN = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Awwal',
  'Jumada al-Thani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal',
  "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

const DAY_MS = 86_400_000;

function monthLength(index: number): number {
  const nibble = parseInt(HIJRI_MONTH_LENGTHS_HEX[index >> 2], 16);
  return (nibble >> (index & 3)) & 1 ? 30 : 29;
}

function epochUtcMs(): number {
  const [y, m, d] = HIJRI_EPOCH_GREGORIAN.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Tabular (Kuwaiti) arithmetic — used only outside the lookup table's range. */
function tabularHijri(gregorianUtcMs: number): HijriDate {
  const jd = Math.floor(gregorianUtcMs / DAY_MS) + 2440588;
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  const l1 = l0 - 10631 * n + 354;
  const j =
    Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) +
    Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
  const l2 =
    l1 -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * l2) / 709);
  const day = l2 - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

/**
 * Converts a Gregorian `Date` (its local calendar date) to Hijri, applying
 * the per-device day `offset`. Exact for 1440-1500 AH (~2018-2077) via the
 * baked lookup table; falls back to tabular arithmetic outside that range.
 */
export function toHijri(date: Date, offset = 0): HijriDate {
  const localMidnightUtcMs = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const adjustedMs = localMidnightUtcMs + offset * DAY_MS;
  const daysSinceEpoch = Math.round((adjustedMs - epochUtcMs()) / DAY_MS);

  if (daysSinceEpoch < 0) return tabularHijri(adjustedMs);

  let remaining = daysSinceEpoch;
  for (let monthIndex = 0; monthIndex < HIJRI_TABLE_MONTH_COUNT; monthIndex += 1) {
    const len = monthLength(monthIndex);
    if (remaining < len) {
      return {
        year: HIJRI_TABLE_START_YEAR + Math.floor(monthIndex / 12),
        month: (monthIndex % 12) + 1,
        day: remaining + 1,
      };
    }
    remaining -= len;
  }
  return tabularHijri(adjustedMs);
}

/** e.g. `1 Rabi' al-Thani 1448 AH` / `1 رمضان 1447 هـ`. Always Western digits. */
export function formatHijri(h: HijriDate, lang: 'en' | 'ar'): string {
  if (lang === 'ar') return `${h.day} ${HIJRI_MONTHS_AR[h.month - 1]} ${h.year} هـ`;
  return `${h.day} ${HIJRI_MONTHS_EN[h.month - 1]} ${h.year} AH`;
}

/**
 * The Gregorian `[start, end]` (inclusive, as YYYY-MM-DD day keys) of a
 * given Hijri year/month at the given day `offset` — for the monthly
 * report's Hijri mode. Throws outside the lookup table's range.
 */
export function hijriMonthRange(year: number, month: number, offset = 0): { start: string; end: string } {
  const monthIndex = (year - HIJRI_TABLE_START_YEAR) * 12 + (month - 1);
  if (monthIndex < 0 || monthIndex >= HIJRI_TABLE_MONTH_COUNT) {
    throw new Error(`hijriMonthRange: ${year}-${month} is outside the lookup table`);
  }
  let daysBefore = 0;
  for (let i = 0; i < monthIndex; i += 1) daysBefore += monthLength(i);

  const startMs = epochUtcMs() + daysBefore * DAY_MS - offset * DAY_MS;
  const endMs = startMs + (monthLength(monthIndex) - 1) * DAY_MS;
  const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { start: toKey(startMs), end: toKey(endMs) };
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test -- hijri.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add scripts/generate-hijri-table.js src/lib/hijriTable.ts src/lib/hijri.ts __tests__/hijri.test.ts
git commit -m "feat(hijri): add Hijri calendar module with generated Umm al-Qura table

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `stats.ts`

**Files:**
- Create: `src/lib/stats.ts`
- Test: `__tests__/stats.test.ts`

**Interfaces:**
- Consumes: `PRAYER_KEYS`, `Marks`, `PrayerKey` from `src/types/index.ts`; `dayKeyParts` from `src/lib/dates.ts` (Task 1).
- Produces: `computeStats(marksByDay: Record<string, Marks | undefined>): PersonStats`, `type PersonStats = Record<PrayerKey, number> & { jumah: number; totalDone: number; totalPossible: number }`. Used by Tasks 16 and 17 (report screens), once per person.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/stats.test.ts`:

```ts
import { computeStats } from '../src/lib/stats';

describe('computeStats', () => {
  it('counts a weekday Dhuhr under dhuhr, not jumah', () => {
    const stats = computeStats({ '2026-09-10': { dhuhr: 1000 } }); // Thursday
    expect(stats.dhuhr).toBe(1);
    expect(stats.jumah).toBe(0);
    expect(stats.totalDone).toBe(1);
    expect(stats.totalPossible).toBe(5);
  });

  it('counts a Friday Dhuhr under jumah, not dhuhr', () => {
    const stats = computeStats({ '2026-09-11': { dhuhr: 1000 } }); // Friday
    expect(stats.dhuhr).toBe(0);
    expect(stats.jumah).toBe(1);
    expect(stats.totalDone).toBe(1);
  });

  it('counts every prayer key independently', () => {
    const stats = computeStats({
      '2026-09-10': { fajr: 1, dhuhr: 2, asr: 3, maghrib: 4, isha: 5 },
    });
    expect(stats.fajr).toBe(1);
    expect(stats.asr).toBe(1);
    expect(stats.maghrib).toBe(1);
    expect(stats.isha).toBe(1);
    expect(stats.totalDone).toBe(5);
  });

  it('treats a null mark as not done', () => {
    expect(computeStats({ '2026-09-10': { fajr: null } }).fajr).toBe(0);
  });

  it('treats a missing day (no marks at all) as 5 possible, 0 done', () => {
    const stats = computeStats({ '2026-09-10': undefined });
    expect(stats.totalPossible).toBe(5);
    expect(stats.totalDone).toBe(0);
  });

  it('sums totalPossible across multiple days', () => {
    const stats = computeStats({
      '2026-09-10': { fajr: 1 },
      '2026-09-11': { fajr: 1 },
      '2026-09-12': undefined,
    });
    expect(stats.totalPossible).toBe(15);
    expect(stats.totalDone).toBe(2);
  });

  it('returns all zeros for an empty range', () => {
    expect(computeStats({})).toEqual({
      fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, jumah: 0,
      totalDone: 0, totalPossible: 0,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- stats.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/stats.ts`:

```ts
import { Marks, PRAYER_KEYS, PrayerKey } from '../types';
import { dayKeyParts } from './dates';

export type PersonStats = Record<PrayerKey, number> & {
  jumah: number;
  totalDone: number;
  totalPossible: number;
};

/**
 * Aggregates one person's completion counts across a set of days.
 * `marksByDay` maps a day key (`YYYY-MM-DD`) to that person's Marks for that
 * day (already picked out of the DayDoc by the caller), or `undefined` for a
 * day with no document yet. Friday's `dhuhr` mark is counted under `jumah`
 * instead of `dhuhr`, matching the label shown in the UI; `totalPossible` is
 * unaffected — still 5 per day.
 */
export function computeStats(marksByDay: Record<string, Marks | undefined>): PersonStats {
  const stats: PersonStats = {
    fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0, jumah: 0,
    totalDone: 0, totalPossible: 0,
  };

  for (const [dayKey, marks] of Object.entries(marksByDay)) {
    stats.totalPossible += PRAYER_KEYS.length;
    if (!marks) continue;

    const { y, m, d } = dayKeyParts(dayKey);
    const isFriday = new Date(y, m - 1, d).getDay() === 5;

    for (const key of PRAYER_KEYS) {
      if (marks[key] == null) continue;
      stats.totalDone += 1;
      if (key === 'dhuhr' && isFriday) {
        stats.jumah += 1;
      } else {
        stats[key] += 1;
      }
    }
  }

  return stats;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- stats.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats.ts __tests__/stats.test.ts
git commit -m "feat(stats): add computeStats for weekly/monthly reports

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `direction.ts` (pure RTL-switch decision)

**Files:**
- Create: `src/lib/direction.ts`
- Test: `__tests__/direction.test.ts`

**Interfaces:**
- Produces: `decideDirection(state: DirectionState): 'none' | 'reload'`, `type DirectionState = { language: 'en'|'ar'; isRTL: boolean; reloadedForLanguage: 'en'|'ar'|null }`. Consumed by Task 7's `useLanguageDirection` hook — deliberately kept in a separate, RN-free file so it can be unit-tested the same way `layout.ts` is (this repo's tests run under plain `ts-jest`, not a React Native preset, so a file that `import`s `react-native` cannot be loaded by the test runner).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/direction.test.ts`:

```ts
import { decideDirection } from '../src/lib/direction';

describe('decideDirection', () => {
  it('does nothing when the flag already matches Arabic', () => {
    expect(decideDirection({ language: 'ar', isRTL: true, reloadedForLanguage: null })).toBe('none');
  });

  it('does nothing when the flag already matches English', () => {
    expect(decideDirection({ language: 'en', isRTL: false, reloadedForLanguage: null })).toBe('none');
  });

  it('reloads when Arabic is wanted but the flag is still LTR', () => {
    expect(decideDirection({ language: 'ar', isRTL: false, reloadedForLanguage: null })).toBe('reload');
  });

  it('reloads when English is wanted but the flag is still RTL', () => {
    expect(decideDirection({ language: 'en', isRTL: true, reloadedForLanguage: null })).toBe('reload');
  });

  it('does not reload again for a language it already tried (loop guard)', () => {
    expect(decideDirection({ language: 'ar', isRTL: false, reloadedForLanguage: 'ar' })).toBe('none');
  });

  it('tries again if the wanted language changed since the last attempt', () => {
    expect(decideDirection({ language: 'en', isRTL: true, reloadedForLanguage: 'ar' })).toBe('reload');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- direction.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/direction.ts`:

```ts
export type DirectionState = {
  language: 'en' | 'ar';
  /** The native layout direction right now (`I18nManager.isRTL`). */
  isRTL: boolean;
  /** The language we last reloaded the app for, or null if never. */
  reloadedForLanguage: 'en' | 'ar' | null;
};

/**
 * Pure decision for whether the native RTL flag needs to change: 'reload' if
 * `language` and `isRTL` disagree and we have not already tried reloading
 * for this exact language; 'none' otherwise. The "already tried" check
 * prevents a reload loop if the OS ever refuses to change the flag.
 */
export function decideDirection(state: DirectionState): 'none' | 'reload' {
  const wantsRTL = state.language === 'ar';
  if (state.isRTL === wantsRTL) return 'none';
  if (state.reloadedForLanguage === state.language) return 'none';
  return 'reload';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- direction.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/direction.ts __tests__/direction.test.ts
git commit -m "feat(direction): add pure RTL-switch decision logic

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `src/i18n/strings.ts` — the en/ar table, `translate()`, and `useT()`

**Files:**
- Create: `src/i18n/strings.ts`
- Test: `__tests__/i18n.test.ts`

**Interfaces:**
- Produces: `en`, `ar` (both `type Strings = typeof en`), `translate(lang: 'en'|'ar', key: string, vars?: Record<string,string|number>): string`, `useT(): (key: string, vars?) => string`. Every later screen task (9, 10, 11, 12, 13, 16, 17) calls `useT()`.
- Consumes: `useAppState` from `src/state/AppStateContext.tsx` (already exists, unchanged by this task).

- [ ] **Step 1: Write the failing tests**

Create `__tests__/i18n.test.ts`:

```ts
import { ar, en, translate } from '../src/i18n/strings';

function collectKeys(obj: unknown, prefix = ''): string[] {
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null ? collectKeys(v, path) : [path];
  });
}

function valueAt(obj: unknown, path: string): unknown {
  return path.split('.').reduce((o: any, k) => o[k], obj);
}

describe('i18n completeness', () => {
  it('en and ar expose exactly the same set of keys', () => {
    expect(collectKeys(ar).sort()).toEqual(collectKeys(en).sort());
  });

  it('no Arabic value is empty', () => {
    for (const key of collectKeys(ar)) {
      expect(String(valueAt(ar, key)).length).toBeGreaterThan(0);
    }
  });
});

describe('translate', () => {
  it('looks up a nested key in each language', () => {
    expect(translate('en', 'common.done')).toBe('Done');
    expect(translate('ar', 'common.done')).toBe('تم');
  });

  it('interpolates variables', () => {
    expect(translate('en', 'dashboard.footer', { code: '123456' })).toBe(
      'Room 123456 · resets at midnight · live sync',
    );
  });

  it('interpolates the same variable used more than once', () => {
    expect(translate('en', 'settings.usingCoords', { lat: '30.044', lng: '31.236' })).toBe(
      'Using 30.044, 31.236',
    );
  });

  it('throws on a missing key', () => {
    expect(() => translate('en', 'nope.nope')).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- i18n.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/i18n/strings.ts`:

```ts
import { useCallback } from 'react';

import { useAppState } from '../state/AppStateContext';

export const en = {
  common: {
    appName: 'Yalla Salah',
    cancel: 'Cancel',
    done: 'Done',
    back: 'Back',
    share: 'Share',
    copy: 'Copy',
  },
  onboarding: {
    tagline: 'Keep each other on track, five times a day.',
    nameLabel: 'Your name',
    namePlaceholder: 'e.g. Dad, Omar',
    createRoom: 'Create a room',
    haveCode: 'I have a code',
    codeLabel: '6-digit room code',
    joinRoom: 'Join room',
    errorCreateFailed: 'Could not create a room.',
    errorJoinFailed: 'Could not join that room.',
    errorEnterFullCode: 'Enter the full 6-digit code.',
    connecting: 'Connecting to the sync service…',
    footnote:
      "Share the room code with one other person. Only the two of you can see each other's checklist.",
  },
  dashboard: {
    openSettings: 'Open settings',
    tapToDismiss: 'Tap to dismiss',
    inviteTitle: 'Invite your partner',
    inviteBody:
      'Share this code. They enter it on their phone to pair, and the second column fills in.',
    copyCode: 'Copy code',
    locationHintTitle: 'Use your location?',
    locationHintBody: 'For accurate prayer times where you are.',
    allow: 'Allow',
    pickCity: 'Pick city',
    dismiss: 'Dismiss',
    locationUnavailableTitle: 'Location unavailable',
    locationUnavailableBody:
      'No problem — pick your city in Settings and prayer times will use that instead.',
    shareMessage: 'Track our daily Salah together on {appName} 🕌\nRoom code: {code}',
    footer: 'Room {code} · resets at midnight · live sync',
  },
  banner: {
    currentWindow: 'Current window',
    upNext: 'Up next',
    countdownSuffix: '{name} in',
  },
  prayerTable: {
    header: 'Prayer',
    now: 'now',
    completed: 'completed',
    notCompleted: 'not completed',
    nobodyJoinedYet: 'nobody has joined yet',
  },
  settings: {
    title: 'Settings',
    sectionLanguage: 'Language',
    languageHint: 'The app restarts once to switch direction.',
    sectionDisplayName: 'Display name',
    namePlaceholder: 'Your name',
    saveName: 'Save name',
    sectionRoomCode: 'Room code',
    roomCodeHint: 'Share this with the other person so they can join.',
    sectionLocation: 'Location',
    useGps: 'Use GPS',
    pickACity: 'Pick a city',
    usingCoords: 'Using {lat}, {lng}',
    locationNotSet: 'Location not set yet — tap below to detect it.',
    detectLocation: 'Detect my location',
    locationDeniedBody:
      'Permission was denied. Enable location for Yalla Salah in system settings, or pick a city instead.',
    locationErrorBody: 'Could not get a location fix. Pick a city instead.',
    cityCalculatedFor: 'Prayer times calculated for {city}, {country}.',
    sectionMethod: 'Calculation method',
    sectionAsr: 'Asr calculation',
    asrStandard: 'Standard',
    asrHanafi: 'Hanafi',
    asrHint: 'Hanafi makes Asr later (shadow length ×2).',
    sectionHijri: 'Hijri date',
    hijriOffsetHint: 'Adjust if your local moon-sighting differs.',
    sectionReports: 'Reports',
    weeklyStats: 'Weekly stats',
    monthlyReport: 'Monthly report',
    sectionDanger: 'Danger zone',
    leaveRoom: 'Leave room',
    leaveConfirmTitle: 'Leave this room?',
    leaveConfirmBody: 'You can rejoin later with the same 6-digit code.',
    leave: 'Leave',
    saveFailedTitle: 'Could not save',
    saveFailedBody: 'Check your connection and try again.',
    versionLabel: '{appName} v{version}',
  },
  reports: {
    last7Days: 'Last 7 days',
    hijri: 'Hijri',
    gregorian: 'Gregorian',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    editableHint: 'Tap a day in the last 7 to fix it.',
    lockedDay: 'This day can no longer be edited.',
    noData: 'No data yet',
    completionLabel: '{done}/{possible} · {pct}%',
  },
};

export type Strings = typeof en;

export const ar: Strings = {
  common: {
    appName: 'يلا صلاة',
    cancel: 'إلغاء',
    done: 'تم',
    back: 'رجوع',
    share: 'مشاركة',
    copy: 'نسخ',
  },
  onboarding: {
    tagline: 'ساعدوا بعض على الالتزام، خمس مرات في اليوم.',
    nameLabel: 'اسمك',
    namePlaceholder: 'مثلاً: بابا، عمر',
    createRoom: 'إنشاء غرفة',
    haveCode: 'لديّ رمز',
    codeLabel: 'رمز الغرفة المكوّن من 6 أرقام',
    joinRoom: 'الانضمام للغرفة',
    errorCreateFailed: 'تعذّر إنشاء الغرفة.',
    errorJoinFailed: 'تعذّر الانضمام لهذه الغرفة.',
    errorEnterFullCode: 'أدخل الرمز كاملاً المكوّن من 6 أرقام.',
    connecting: 'جارٍ الاتصال بخدمة المزامنة…',
    footnote: 'شارك رمز الغرفة مع شخص واحد فقط. لن يرى قائمتكما أحد غيركما.',
  },
  dashboard: {
    openSettings: 'فتح الإعدادات',
    tapToDismiss: 'اضغط للإغلاق',
    inviteTitle: 'ادعُ شريكك',
    inviteBody: 'شارك هذا الرمز. سيُدخله شريكك على هاتفه للاقتران، فيظهر العمود الثاني.',
    copyCode: 'نسخ الرمز',
    locationHintTitle: 'استخدام موقعك؟',
    locationHintBody: 'لحساب أوقات الصلاة بدقة في مكانك.',
    allow: 'سماح',
    pickCity: 'اختيار مدينة',
    dismiss: 'تجاهل',
    locationUnavailableTitle: 'الموقع غير متاح',
    locationUnavailableBody: 'لا مشكلة — اختر مدينتك من الإعدادات وستُحسب أوقات الصلاة عليها.',
    shareMessage: 'تابعوا صلواتكم اليومية معًا على {appName} 🕌\nرمز الغرفة: {code}',
    footer: 'الغرفة {code} · تُعاد كل منتصف ليل · مزامنة مباشرة',
  },
  banner: {
    currentWindow: 'الوقت الحالي',
    upNext: 'القادم',
    countdownSuffix: 'باقٍ على {name}',
  },
  prayerTable: {
    header: 'الصلاة',
    now: 'الآن',
    completed: 'تمّت',
    notCompleted: 'لم تتم',
    nobodyJoinedYet: 'لم ينضم أحد بعد',
  },
  settings: {
    title: 'الإعدادات',
    sectionLanguage: 'اللغة',
    languageHint: 'يُعاد تشغيل التطبيق مرة واحدة لتغيير الاتجاه.',
    sectionDisplayName: 'الاسم المعروض',
    namePlaceholder: 'اسمك',
    saveName: 'حفظ الاسم',
    sectionRoomCode: 'رمز الغرفة',
    roomCodeHint: 'شارك هذا مع الشخص الآخر ليتمكن من الانضمام.',
    sectionLocation: 'الموقع',
    useGps: 'استخدام تحديد الموقع',
    pickACity: 'اختيار مدينة',
    usingCoords: 'يُستخدم {lat}, {lng}',
    locationNotSet: 'لم يُحدَّد الموقع بعد — اضغط أدناه لتحديده.',
    detectLocation: 'تحديد موقعي',
    locationDeniedBody:
      'تم رفض الإذن. فعّل الموقع لتطبيق يلا صلاة من إعدادات النظام، أو اختر مدينة بدلاً من ذلك.',
    locationErrorBody: 'تعذّر تحديد الموقع. اختر مدينة بدلاً من ذلك.',
    cityCalculatedFor: 'تُحسب أوقات الصلاة لِـ {city}، {country}.',
    sectionMethod: 'طريقة الحساب',
    sectionAsr: 'حساب العصر',
    asrStandard: 'قياسي',
    asrHanafi: 'حنفي',
    asrHint: 'المذهب الحنفي يجعل العصر لاحقًا (ضعف طول الظل).',
    sectionHijri: 'التاريخ الهجري',
    hijriOffsetHint: 'عدّل إذا اختلف رصد الهلال في منطقتك.',
    sectionReports: 'التقارير',
    weeklyStats: 'إحصاء الأسبوع',
    monthlyReport: 'التقرير الشهري',
    sectionDanger: 'منطقة الخطر',
    leaveRoom: 'مغادرة الغرفة',
    leaveConfirmTitle: 'مغادرة هذه الغرفة؟',
    leaveConfirmBody: 'يمكنك العودة لاحقًا بنفس الرمز المكوّن من 6 أرقام.',
    leave: 'مغادرة',
    saveFailedTitle: 'تعذّر الحفظ',
    saveFailedBody: 'تحقق من الاتصال وحاول مرة أخرى.',
    versionLabel: '{appName} - الإصدار {version}',
  },
  reports: {
    last7Days: 'آخر 7 أيام',
    hijri: 'هجري',
    gregorian: 'ميلادي',
    previousMonth: 'الشهر السابق',
    nextMonth: 'الشهر التالي',
    editableHint: 'اضغط على يوم من آخر 7 أيام لتعديله.',
    lockedDay: 'لم يعد بالإمكان تعديل هذا اليوم.',
    noData: 'لا توجد بيانات بعد',
    completionLabel: '{done}/{possible} · {pct}%',
  },
};

function valueAt(obj: unknown, path: string): unknown {
  return path.split('.').reduce((o: any, k: string) => (o == null ? undefined : o[k]), obj);
}

/** Looks up `key` (a dotted path, e.g. `"common.done"`) and substitutes any `{var}` placeholders. */
export function translate(
  lang: 'en' | 'ar',
  key: string,
  vars?: Record<string, string | number>,
): string {
  const value = valueAt(lang === 'ar' ? ar : en, key);
  if (typeof value !== 'string') {
    throw new Error(`i18n: missing key "${key}"`);
  }
  if (!vars) return value;
  return Object.entries(vars).reduce(
    (acc, [name, v]) => acc.split(`{${name}}`).join(String(v)),
    value,
  );
}

/** Returns a `t(key, vars?)` function bound to the current device language. */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const { config } = useAppState();
  const lang = config.language ?? 'en';
  return useCallback((key, vars) => translate(lang, key, vars), [lang]);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- i18n.test.ts`
Expected: PASS

- [ ] **Step 5: Run the typecheck**

Run: `npm run typecheck`
Expected: PASS (this is what enforces `ar` having exactly `en`'s keys going forward — any future edit that adds a key to one without the other fails here).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/strings.ts __tests__/i18n.test.ts
git commit -m "feat(i18n): add en/ar string table, translate(), and useT()

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `AppConfig` language/Hijri fields, awaitable `update()`, and the startup RTL check

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/state/AppStateContext.tsx`
- Create: `src/state/useLanguageDirection.ts`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `decideDirection` from `src/lib/direction.ts` (Task 5).
- Produces: `AppConfig.language: Language | null`, `AppConfig.hijriOffset: number`, `AppConfig.reloadedForLanguage: Language | null`; `update()` now returns `Promise<void>` (resolves once the change is persisted); `useLanguageDirection(config, ready, update)`. Consumed by every screen task from here on (`config.language` drives `useT()`; `config.hijriOffset` is read in Task 10; the Settings language toggle in Task 13 calls `update({ language })` and this hook does the rest).

- [ ] **Step 1: Extend `AppConfig`**

In `src/types/index.ts`, add near the other type aliases:

```ts
export type Language = 'en' | 'ar';
```

And add three fields to `AppConfig` (after `dismissedLocationHint: boolean;`):

```ts
  /** null until resolved from the device locale on first launch. */
  language: Language | null;
  /** Per-device Hijri day adjustment, -2..+2. */
  hijriOffset: number;
  /** The language we last reloaded the app for — see useLanguageDirection. */
  reloadedForLanguage: Language | null;
```

- [ ] **Step 2: Make `update()` awaitable and extend `DEFAULT_CONFIG`**

In `src/state/AppStateContext.tsx`, add to `DEFAULT_CONFIG` (after `dismissedLocationHint: false,`):

```ts
  language: null,
  hijriOffset: 0,
  reloadedForLanguage: null,
```

Change the `AppStateValue` type's `update` signature:

```ts
  update: (patch: Partial<AppConfig>) => Promise<void>;
```

Replace `persist` and `update`:

```ts
function persist(config: AppConfig): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config)).catch(() => {
    // Storage is best-effort; an in-memory config still works for this session.
  });
}
```

```ts
  const update = useCallback((patch: Partial<AppConfig>): Promise<void> => {
    let next: AppConfig | undefined;
    setConfig((prev) => {
      next = { ...prev, ...patch };
      return next;
    });
    // `next` is always set here: React invokes a functional setState updater
    // synchronously to resolve the queued value, before this line runs.
    return next ? persist(next) : Promise.resolve();
  }, []);
```

No existing call site needs to change — none of them awaited `update()` before, and a function returning an ignored `Promise<void>` instead of `void` is still valid JavaScript/TypeScript.

- [ ] **Step 3: Create the RTL-switch hook**

Create `src/state/useLanguageDirection.ts`:

```ts
import { useEffect } from 'react';
import { DevSettings, I18nManager } from 'react-native';
import * as Updates from 'expo-updates';

import { decideDirection } from '../lib/direction';
import { AppConfig, Language } from '../types';

function detectDeviceLanguage(): Language {
  const locale = I18nManager.getConstants().localeIdentifier ?? '';
  return locale.toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

async function reloadApp(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    // Not running under expo-updates (e.g. Expo Go / dev client without a
    // configured update channel) — fall back to the JS-only dev reload.
    DevSettings.reload();
  }
}

/**
 * Resolves a first-launch language from the device locale, then keeps the
 * native RTL flag in sync with `config.language` — reloading the app once
 * when they disagree, whether that's from this startup check or from a
 * manual switch in Settings (Task 13 just calls `update({ language })`;
 * this effect does the rest). See src/lib/direction.ts for the tested
 * decision logic this wraps.
 */
export function useLanguageDirection(
  config: AppConfig,
  ready: boolean,
  update: (patch: Partial<AppConfig>) => Promise<void>,
): void {
  useEffect(() => {
    if (!ready) return;

    if (config.language === null) {
      void update({ language: detectDeviceLanguage() });
      return;
    }

    const decision = decideDirection({
      language: config.language,
      isRTL: I18nManager.isRTL,
      reloadedForLanguage: config.reloadedForLanguage,
    });
    if (decision !== 'reload') return;

    const language = config.language;
    void update({ reloadedForLanguage: language }).then(() => {
      const wantsRTL = language === 'ar';
      I18nManager.allowRTL(wantsRTL);
      I18nManager.forceRTL(wantsRTL);
      void reloadApp();
    });
  }, [ready, config.language, config.reloadedForLanguage, update]);
}
```

- [ ] **Step 4: Wire it into `App.tsx`**

Add the import (with the other `src/state` imports):

```ts
import { useLanguageDirection } from './src/state/useLanguageDirection';
```

In `Gate()`, destructure `update` and call the hook before the early returns:

```tsx
function Gate() {
  const t = useTheme();
  const { config, ready: configReady, update } = useAppState();
  const { uid, ready: authReady, error } = useAuth();
  useLanguageDirection(config, configReady, update);

  if (!configReady || !authReady) {
```

(The rest of `Gate()` is unchanged.)

- [ ] **Step 5: Typecheck and smoke-test**

Run: `npm run typecheck`
Expected: PASS

Run: `npx expo start` (press `a` for the Android emulator, or scan the QR code)
Expected: the app launches to Onboarding/Dashboard exactly as before — this task adds no UI yet, it only wires the mechanism that Task 13's language toggle will trigger.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/state/AppStateContext.tsx src/state/useLanguageDirection.ts App.tsx
git commit -m "feat(i18n): add language/Hijri config fields and the RTL-switch hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `DayDoc.y/m/d` and a shared `toggleMark()` for any day

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/state/useRoomSync.ts`

**Interfaces:**
- Consumes: `dayKeyParts` from `src/lib/dates.ts` (Task 1).
- Produces: `toggleMark(roomId: string, uid: string, dayKey: string, prayer: PrayerKey, currentlyDone: boolean): Promise<void>` — a standalone exported function (alongside the existing `createRoom`/`joinRoom`) usable for *any* day, not just today. Consumed by Tasks 16–17 (report screens, editing a past day). The hook's own `toggle()` is refactored to call it, so behavior for today's dashboard is unchanged.
- Every write now carries `y`/`m`/`d` (the Gregorian date the doc represents) — this is what Task 14's Firestore rule checks to enforce the 7-ish-day edit window.

This task has no new pure-logic test (Firestore-dependent, matching this file's existing untested status — `useRoomSync.ts` has never had unit tests, per the original design doc: "UI is verified manually on two devices"). Verify with `npm run typecheck` plus the manual dashboard check in Step 3.

- [ ] **Step 1: Extend `DayDoc`**

In `src/types/index.ts`, replace the `DayDoc` type:

```ts
export type DayDoc = {
  updatedAt?: unknown;
  marks: Record<string, Marks>;
  /**
   * The Gregorian date this document represents, written on every save from
   * this version onward. Used by the Firestore edit-window rule. Absent on
   * days written before this feature shipped — that's fine, they predate
   * the rule and are never re-written outside their own original window.
   */
  y?: number;
  m?: number;
  d?: number;
};
```

- [ ] **Step 2: Update `useRoomSync.ts`**

Add the import (with the other `../lib` import):

```ts
import { dayKeyParts } from '../lib/dates';
```

Add this exported function after `joinRoom` (before `export type RoomSync`):

```ts
/**
 * Toggles one prayer mark for a specific day. Used directly by the
 * weekly/monthly report screens to fix a forgotten tick on a past day; the
 * `useRoomSync` hook's own `toggle()` below just calls this for `dayKey`.
 */
export async function toggleMark(
  roomId: string,
  uid: string,
  dayKey: string,
  prayer: PrayerKey,
  currentlyDone: boolean,
): Promise<void> {
  const { y, m, d } = dayKeyParts(dayKey);
  await setDoc(
    dayRef(roomId, dayKey),
    {
      updatedAt: serverTimestamp(),
      y,
      m,
      d,
      marks: { [uid]: { [prayer]: currentlyDone ? null : Date.now() } },
    },
    { merge: true },
  );
}
```

Replace the hook's `toggle` implementation with:

```ts
  const toggle = useCallback(
    async (prayer: PrayerKey) => {
      if (!roomId || !uid) return;

      const mine = dayRefValue.current?.marks?.[uid] ?? {};
      const isDone = mine[prayer] != null;

      try {
        await toggleMark(roomId, uid, dayKey, prayer, isDone);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : 'Could not save. Check your connection.';
        setError(message);
        throw e;
      }
    },
    [roomId, uid, dayKey],
  );
```

- [ ] **Step 3: Typecheck and manually verify today's dashboard still works**

Run: `npm run typecheck`
Expected: PASS

Run: `npx expo start`, tap a prayer on each of two paired devices (or one device plus the Firebase console's Firestore data viewer).
Expected: the tap still marks/unmarks instantly as before, and the day document in Firestore now also shows `y`, `m`, `d` fields matching today's date.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/state/useRoomSync.ts
git commit -m "feat(rooms): write y/m/d on every mark, add toggleMark() for any day

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `LanguageSwitch` component, `TextField` RTL fix, and `OnboardingScreen` translation

**Files:**
- Create: `src/components/LanguageSwitch.tsx`
- Modify: `src/components/TextField.tsx:34,42`
- Modify: `src/screens/OnboardingScreen.tsx`

**Interfaces:**
- Consumes: `useT` (Task 6), `useAppState` (Task 7 — `config.language`, `update`).
- Produces: `<LanguageSwitch />` — a self-contained English/العربية toggle, reused by Task 13 (Settings).

No new pure-logic test (this is a screen). Verify by running the app in both languages.

- [ ] **Step 1: Create the shared language toggle**

Create `src/components/LanguageSwitch.tsx`:

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppState } from '../state/AppStateContext';
import { useTheme, type Theme } from '../theme/colors';

/**
 * The English/Arabic toggle. Each option is always labelled in its own
 * language (never translated), so it stays findable no matter which
 * language the app is currently showing.
 */
export function LanguageSwitch() {
  const t = useTheme();
  const { config, update } = useAppState();
  const active = config.language ?? 'en';

  return (
    <View style={[styles.wrap, { borderColor: t.border }]}>
      <Option t={t} label="English" active={active === 'en'} onPress={() => void update({ language: 'en' })} />
      <Option t={t} label="العربية" active={active === 'ar'} onPress={() => void update({ language: 'ar' })} />
    </View>
  );
}

function Option({
  t,
  label,
  active,
  onPress,
}: {
  t: Theme;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.option, active && { backgroundColor: t.primary }]}
    >
      <Text style={[styles.label, { color: active ? t.onPrimary : t.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignSelf: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  option: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  label: { fontSize: 13, fontWeight: '700' },
});
```

- [ ] **Step 2: Fix `TextField`'s RTL-sensitive margins**

In `src/components/TextField.tsx`, in the `styles` object, replace:

```ts
  label: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
```

with:

```ts
  label: { fontSize: 13, fontWeight: '600', marginStart: 4 },
```

and replace:

```ts
  hint: { fontSize: 12, marginLeft: 4 },
```

with:

```ts
  hint: { fontSize: 12, marginStart: 4 },
```

(`marginStart` is React Native's logical property — it means "leading edge," which RTL mode automatically flips to the right. A literal `marginLeft` would stay on the visual left even when the layout mirrors.)

- [ ] **Step 3: Translate `OnboardingScreen.tsx`**

Replace the full contents of `src/screens/OnboardingScreen.tsx`:

```tsx
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '../components/Button';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { TextField } from '../components/TextField';
import { NAME_MAX_LENGTH } from '../config/constants';
import { useT } from '../i18n/strings';
import { isValidCode, normalizeCode } from '../lib/code';
import { tapFeedback } from '../lib/haptics';
import { useAppState } from '../state/AppStateContext';
import { createRoom, joinRoom } from '../state/useRoomSync';
import { useTheme } from '../theme/colors';

type Mode = 'choose' | 'join';

export function OnboardingScreen({ uid }: { uid: string | null }) {
  const t = useTheme();
  const tr = useT();
  const { update } = useAppState();

  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('choose');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<null | 'create' | 'join'>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length >= 1;
  const connecting = !uid;

  async function handleCreate() {
    if (!uid || !nameOk) return;
    setBusy('create');
    setError(null);
    try {
      const newCode = await createRoom(uid, name);
      tapFeedback('success');
      update({ displayName: name.trim(), roomId: newCode });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tr('onboarding.errorCreateFailed'));
      tapFeedback('warning');
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    if (!uid || !nameOk) return;
    if (!isValidCode(code)) {
      setError(tr('onboarding.errorEnterFullCode'));
      return;
    }
    setBusy('join');
    setError(null);
    try {
      await joinRoom(uid, name, code.trim());
      tapFeedback('success');
      update({ displayName: name.trim(), roomId: code.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tr('onboarding.errorJoinFailed'));
      tapFeedback('warning');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <LanguageSwitch />

          <View style={styles.hero}>
            <Text style={[styles.crescent, { color: t.primary }]}>☾</Text>
            <Text style={[styles.brand, { color: t.text }]}>{tr('common.appName')}</Text>
            <Text style={[styles.tagline, { color: t.textDim }]}>{tr('onboarding.tagline')}</Text>
          </View>

          <View style={styles.form}>
            <TextField
              label={tr('onboarding.nameLabel')}
              placeholder={tr('onboarding.namePlaceholder')}
              value={name}
              onChangeText={setName}
              maxLength={NAME_MAX_LENGTH}
              autoCapitalize="words"
              returnKeyType="done"
            />

            {mode === 'choose' ? (
              <View style={styles.actions}>
                <Button
                  label={tr('onboarding.createRoom')}
                  onPress={handleCreate}
                  disabled={!nameOk || connecting}
                  loading={busy === 'create'}
                />
                <Button
                  label={tr('onboarding.haveCode')}
                  variant="ghost"
                  onPress={() => {
                    setError(null);
                    setMode('join');
                  }}
                  disabled={connecting}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <TextField
                  label={tr('onboarding.codeLabel')}
                  placeholder="000000"
                  value={code}
                  onChangeText={(v) => setCode(normalizeCode(v))}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={[styles.codeInput, styles.ltr]}
                />
                <Button
                  label={tr('onboarding.joinRoom')}
                  onPress={handleJoin}
                  disabled={!nameOk || !isValidCode(code) || connecting}
                  loading={busy === 'join'}
                />
                <Button
                  label={tr('common.back')}
                  variant="ghost"
                  onPress={() => {
                    setError(null);
                    setMode('choose');
                  }}
                />
              </View>
            )}

            {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
            {connecting ? (
              <Text style={[styles.note, { color: t.textDim }]}>{tr('onboarding.connecting')}</Text>
            ) : null}
          </View>

          <Text style={[styles.footnote, { color: t.textDim }]}>{tr('onboarding.footnote')}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 24 },
  hero: { alignItems: 'center', gap: 6 },
  crescent: { fontSize: 56, lineHeight: 64 },
  brand: { fontSize: 30, fontWeight: '800', letterSpacing: 0.3 },
  tagline: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  form: { gap: 18 },
  actions: { gap: 12 },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '800',
    textAlign: 'center',
  },
  // The room code is always Western digits, left-to-right, in both languages.
  ltr: { writingDirection: 'ltr' },
  error: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  note: { fontSize: 12, textAlign: 'center' },
  footnote: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
```

Note: `APP_NAME` is no longer imported here (the brand text now comes from `tr('common.appName')`); `styles.hero`'s outer `gap` changed from `32` to `24` only because the new `<LanguageSwitch />` needs its own breathing room above it — add `marginBottom: 8` to `hero` if it looks cramped when you run it; use your judgment against the running app in Step 4.

- [ ] **Step 4: Typecheck and manually verify both languages**

Run: `npm run typecheck`
Expected: PASS

Run: `npx expo start`, open Onboarding, tap "العربية".
Expected: the app reloads once, then shows the onboarding screen mirrored right-to-left with Arabic text, the room-code input still reading left-to-right. Tap "English" to switch back and confirm it reloads back to the original layout.

- [ ] **Step 5: Commit**

```bash
git add src/components/LanguageSwitch.tsx src/components/TextField.tsx src/screens/OnboardingScreen.tsx
git commit -m "feat(i18n): translate onboarding and add the language switch

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: `DashboardScreen` — Hijri date line, translation, digits

**Files:**
- Modify: `src/screens/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `useT` (Task 6), `dayKeyParts` (Task 1), `toHijri`/`formatHijri` (Task 3), `toArabicDigits` (Task 2), `config.language`/`config.hijriOffset` (Task 7).

No new pure-logic test (this is a screen). Verify by running the app.

- [ ] **Step 1: Replace the full contents of `src/screens/DashboardScreen.tsx`**

```tsx
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { PrayerTable } from '../components/PrayerTable';
import { WindowBanner } from '../components/WindowBanner';
import { toArabicDigits } from '../lib/digits';
import { dayKeyParts, humanDate } from '../lib/dates';
import { tapFeedback } from '../lib/haptics';
import { formatHijri, toHijri } from '../lib/hijri';
import { type Metrics } from '../lib/layout';
import { useMetrics } from '../lib/useMetrics';
import { useT } from '../i18n/strings';
import { findCity } from '../services/cities';
import { detectCoords } from '../services/location';
import { computeTimes } from '../services/prayerTimes';
import { useAppState } from '../state/AppStateContext';
import { useNow } from '../state/useNow';
import { useRoomSync } from '../state/useRoomSync';
import { useToday } from '../state/useToday';
import { useTheme, type Theme } from '../theme/colors';
import { Coords, PrayerKey } from '../types';
import { SettingsModal } from './SettingsModal';

type T = (key: string, vars?: Record<string, string | number>) => string;

export function DashboardScreen({ uid }: { uid: string }) {
  const t = useTheme();
  const tr = useT();
  const m = useMetrics();
  const { config, update } = useAppState();
  const today = useToday();
  const now = useNow(1000);
  const lang = config.language ?? 'en';

  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    room,
    loading,
    error,
    setError,
    partnerUid,
    myMarks,
    partnerMarks,
    toggle,
    rename,
    leave,
  } = useRoomSync(config.roomId, uid, today);

  const coords = useMemo<Coords>(() => {
    if (config.locationMode === 'gps' && config.coords) return config.coords;
    const city = findCity(config.cityId);
    return { lat: city.lat, lng: city.lng };
  }, [config.locationMode, config.coords, config.cityId]);

  // Prayer times only need recomputing once a minute (and when config / day
  // changes), even though `now` ticks every second for the countdown.
  const minuteBucket = Math.floor(now / 60_000);
  const prayer = useMemo(
    () =>
      computeTimes({
        lat: coords.lat,
        lng: coords.lng,
        methodKey: config.method,
        madhab: config.madhab,
        date: new Date(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coords.lat, coords.lng, config.method, config.madhab, minuteBucket, today],
  );

  const gregorianDate = useMemo(() => {
    const text = humanDate(new Date(now), lang);
    return lang === 'ar' ? toArabicDigits(text) : text;
  }, [now, lang]);

  const hijriDate = useMemo(() => {
    const { y, m: mo, d } = dayKeyParts(today);
    const h = toHijri(new Date(y, mo - 1, d), config.hijriOffset);
    const text = formatHijri(h, lang);
    return lang === 'ar' ? toArabicDigits(text) : text;
  }, [today, config.hijriOffset, lang]);

  const myName = room?.names?.[uid] || config.displayName || 'Me';
  const partnerName = partnerUid ? room?.names?.[partnerUid] || 'Partner' : null;

  const onToggle = useCallback(
    async (p: PrayerKey) => {
      const wasDone = myMarks[p] != null;
      tapFeedback(wasDone ? 'light' : 'success');
      try {
        await toggle(p);
      } catch {
        tapFeedback('warning');
      }
    },
    [toggle, myMarks],
  );

  const shareCode = useCallback(async () => {
    if (!config.roomId) return;
    try {
      await Share.share({
        message: tr('dashboard.shareMessage', { appName: tr('common.appName'), code: config.roomId }),
      });
    } catch {
      // dismissed
    }
  }, [config.roomId, tr]);

  const copyCode = useCallback(async () => {
    if (!config.roomId) return;
    await Clipboard.setStringAsync(config.roomId);
    tapFeedback('success');
  }, [config.roomId]);

  const allowLocation = useCallback(async () => {
    const result = await detectCoords();
    if (result.ok) {
      update({ coords: result.coords, dismissedLocationHint: true });
      tapFeedback('success');
    } else {
      update({ dismissedLocationHint: true });
      Alert.alert(tr('dashboard.locationUnavailableTitle'), tr('dashboard.locationUnavailableBody'));
    }
  }, [update, tr]);

  const showLocationHint =
    config.locationMode === 'gps' && !config.coords && !config.dismissedLocationHint;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: m.pagePadding, gap: m.tiny ? 10 : 14 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.brand, { color: t.text }]} numberOfLines={1}>
              {tr('common.appName')}
            </Text>
            <Text style={[styles.date, { color: t.textDim }]} numberOfLines={1}>
              {gregorianDate}
            </Text>
            <Text style={[styles.hijri, { color: t.textDim }]} numberOfLines={1}>
              {hijriDate}
            </Text>
          </View>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={tr('dashboard.openSettings')}
            style={[styles.gear, { borderColor: t.border, backgroundColor: t.surface }]}
          >
            <Text style={styles.gearIcon}>⚙︎</Text>
          </Pressable>
        </View>

        <WindowBanner
          metrics={m}
          times={prayer.times}
          currentKey={prayer.currentKey}
          next={prayer.next}
          now={now}
        />

        {showLocationHint ? (
          <LocationHint
            t={t}
            tr={tr}
            onAllow={allowLocation}
            onPickCity={() => setSettingsOpen(true)}
            onDismiss={() => update({ dismissedLocationHint: true })}
          />
        ) : null}

        {error ? (
          <Pressable
            onPress={() => setError(null)}
            style={[styles.errorBox, { borderColor: t.danger, backgroundColor: t.surface }]}
          >
            <Text style={[styles.errorText, { color: t.danger }]}>{error}</Text>
            <Text style={[styles.errorDismiss, { color: t.textDim }]}>{tr('dashboard.tapToDismiss')}</Text>
          </Pressable>
        ) : null}

        {loading && !room ? (
          <View style={styles.loading}>
            <ActivityIndicator color={t.primary} />
          </View>
        ) : (
          <PrayerTable
            metrics={m}
            myName={myName}
            partnerName={partnerName}
            myMarks={myMarks}
            partnerMarks={partnerMarks}
            times={prayer.times}
            currentKey={prayer.currentKey}
            onToggle={onToggle}
          />
        )}

        {!loading && !partnerUid ? (
          <InviteCard t={t} m={m} tr={tr} code={config.roomId ?? '—'} onCopy={copyCode} onShare={shareCode} />
        ) : null}

        <Text style={[styles.footer, { color: t.textDim }]} numberOfLines={2}>
          {tr('dashboard.footer', { code: config.roomId ?? '' })}
        </Text>
      </ScrollView>

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        myName={myName}
        code={config.roomId}
        onRename={async (name) => {
          await rename(name);
          update({ displayName: name });
        }}
        onLeave={async () => {
          await leave();
          update({ roomId: null });
          setSettingsOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Local components                                                    */
/* ------------------------------------------------------------------ */

function InviteCard({
  t,
  m,
  tr,
  code,
  onCopy,
  onShare,
}: {
  t: Theme;
  m: Metrics;
  tr: T;
  code: string;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <View
      style={[
        styles.invite,
        { backgroundColor: t.surfaceAlt, borderColor: t.border, padding: m.cardPadding + 2 },
      ]}
    >
      <Text style={[styles.inviteTitle, { color: t.text }]}>{tr('dashboard.inviteTitle')}</Text>
      <Text style={[styles.inviteBody, { color: t.textDim }]}>{tr('dashboard.inviteBody')}</Text>
      <View style={[styles.inviteCodeBox, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Text
          style={[styles.inviteCode, styles.ltr, { color: t.primary, letterSpacing: m.tiny ? 4 : 8 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {code}
        </Text>
      </View>
      <View style={m.tiny ? styles.inviteButtonsStacked : styles.inviteButtonsRow}>
        {/* `flex: 1` only makes sense while the buttons sit side by side; in a
            column it would stretch them vertically. */}
        <Button label={tr('common.share')} onPress={onShare} style={m.tiny ? undefined : styles.grow} />
        <Button
          label={tr('dashboard.copyCode')}
          variant="secondary"
          onPress={onCopy}
          style={m.tiny ? undefined : styles.grow}
        />
      </View>
    </View>
  );
}

function LocationHint({
  t,
  tr,
  onAllow,
  onPickCity,
  onDismiss,
}: {
  t: Theme;
  tr: T;
  onAllow: () => void;
  onPickCity: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={[styles.hint, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.hintTextWrap}>
        <Text style={[styles.hintTitle, { color: t.text }]}>{tr('dashboard.locationHintTitle')}</Text>
        <Text style={[styles.hintBody, { color: t.textDim }]}>{tr('dashboard.locationHintBody')}</Text>
      </View>
      <View style={styles.hintActions}>
        <Pressable onPress={onAllow} hitSlop={8}>
          <Text style={[styles.hintAllow, { color: t.primary }]}>{tr('dashboard.allow')}</Text>
        </Pressable>
        <Pressable onPress={onPickCity} hitSlop={8}>
          <Text style={[styles.hintSecondary, { color: t.textDim }]}>{tr('dashboard.pickCity')}</Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={[styles.hintSecondary, { color: t.textDim }]}>{tr('dashboard.dismiss')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  date: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  hijri: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { fontSize: 18 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  errorBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 2 },
  errorText: { fontSize: 13, fontWeight: '700' },
  errorDismiss: { fontSize: 11 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 6 },

  invite: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  inviteTitle: { fontSize: 15, fontWeight: '800' },
  inviteBody: { fontSize: 12, lineHeight: 17 },
  inviteCodeBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  inviteCode: { fontSize: 26, fontWeight: '900' },
  inviteButtonsRow: { flexDirection: 'row', gap: 8 },
  inviteButtonsStacked: { gap: 8 },
  grow: { flex: 1 },
  // The room code is always Western digits, left-to-right, in both languages.
  ltr: { writingDirection: 'ltr' },

  hint: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  hintTextWrap: { gap: 2 },
  hintTitle: { fontSize: 14, fontWeight: '800' },
  hintBody: { fontSize: 12 },
  hintActions: { flexDirection: 'row', gap: 18, alignItems: 'center', flexWrap: 'wrap' },
  hintAllow: { fontSize: 13, fontWeight: '800' },
  hintSecondary: { fontSize: 13, fontWeight: '600' },
});
```

Note: `APP_NAME` is no longer imported (the brand text comes from `tr('common.appName')`); the share message no longer needs the 🕌 emoji hardcoded outside the string — it is already inside `dashboard.shareMessage` in both languages (Task 6).

- [ ] **Step 2: Typecheck and manually verify**

Run: `npm run typecheck`
Expected: PASS

Run: `npx expo start`, open the dashboard.
Expected: the header shows the Gregorian date, then the Hijri date on its own line below (e.g. `1 Rabi' al-Thani 1448 AH`); switching to Arabic (via the toggle added in Task 9's Onboarding — or Task 13's Settings, once that lands) shows both lines in Arabic with Arabic-Indic digits, while the room code and invite-code box stay Western digits and left-to-right.

- [ ] **Step 3: Commit**

```bash
git add src/screens/DashboardScreen.tsx
git commit -m "feat(dashboard): add the Hijri date line and translate the screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: `WindowBanner` — Jum'ah label, translation, digits

**Files:**
- Modify: `src/components/WindowBanner.tsx`

**Interfaces:**
- Consumes: `prayersFor` (Task 2), `useT` (Task 6), `toArabicDigits` (Task 2), `formatCountdown`/`formatTime` with their new `lang` parameter (Task 1).

No new pure-logic test (this is a component; `prayersFor` and the date formatters already have their own unit tests). Verify by running the app on a Friday-dated device clock, or by temporarily hardcoding a Friday `Date` while checking manually, then reverting.

- [ ] **Step 1: Replace the full contents of `src/components/WindowBanner.tsx`**

```tsx
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatCountdown, formatTime } from '../lib/dates';
import { toArabicDigits } from '../lib/digits';
import { Metrics } from '../lib/layout';
import { prayersFor } from '../lib/prayers';
import { useT } from '../i18n/strings';
import { useAppState } from '../state/AppStateContext';
import { useTheme } from '../theme/colors';
import { PrayerKey } from '../types';

type Props = {
  metrics: Metrics;
  times: Record<PrayerKey, Date>;
  currentKey: PrayerKey | null;
  next: { key: PrayerKey; at: Date } | null;
  now: number;
};

export function WindowBanner({ metrics: m, times, currentKey, next, now }: Props) {
  const t = useTheme();
  const tr = useT();
  const { config } = useAppState();
  const lang = config.language ?? 'en';
  const localize = (s: string) => (lang === 'ar' ? toArabicDigits(s) : s);

  const prayers = prayersFor(new Date(now));
  const label = (key: PrayerKey): string => {
    const p = prayers.find((x) => x.key === key);
    if (!p) return '—';
    return lang === 'ar' ? p.ar : p.en;
  };
  const chipLabel = (key: PrayerKey): string => {
    const p = prayers.find((x) => x.key === key);
    if (!p) return '—';
    return lang === 'ar' ? p.ar : p.short;
  };

  const currentName = currentKey ? label(currentKey) : null;
  const nextName = next ? label(next.key) : null;
  const remaining = next ? Math.max(0, next.at.getTime() - now) : 0;

  const countdown = next ? (
    <View style={m.stackBanner ? styles.countdownStacked : styles.countdownInline}>
      <Text style={[styles.cdLabel, { color: white(0.8) }]} numberOfLines={1}>
        {tr('banner.countdownSuffix', { name: nextName ?? '—' })}
      </Text>
      <Text style={[styles.cdValue, { color: t.onPrimary }]} numberOfLines={1}>
        {localize(formatCountdown(remaining, lang))}
      </Text>
    </View>
  ) : null;

  return (
    <View style={[styles.card, { backgroundColor: t.primary, padding: m.tiny ? 13 : 16 }]}>
      {/* Side by side normally; stacked once the text is scaled up or the
          screen is narrow, where two columns would collide. */}
      <View style={m.stackBanner ? styles.topStacked : styles.topRow}>
        <View style={styles.headline}>
          <Text style={[styles.kicker, { color: white(0.75) }]} numberOfLines={1}>
            {currentKey ? tr('banner.currentWindow') : tr('banner.upNext')}
          </Text>
          <Text
            style={[styles.big, { color: t.onPrimary, fontSize: m.bannerTitleSize }]}
            numberOfLines={1}
          >
            {currentName ?? nextName ?? '—'}
          </Text>
        </View>
        {countdown}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {prayers.map((p) => {
          const active = currentKey === p.key;
          const isNext = next?.key === p.key;
          return (
            <View
              key={p.key}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? t.onPrimary : white(0.14),
                  borderColor: isNext ? t.accent : 'transparent',
                  minWidth: m.tiny ? 58 : 66,
                },
              ]}
            >
              <Text
                style={[styles.chipName, { color: active ? t.primary : t.onPrimary }]}
                numberOfLines={1}
              >
                {chipLabel(p.key)}
              </Text>
              <Text
                style={[styles.chipTime, { color: active ? t.primary : white(0.85) }]}
                numberOfLines={1}
              >
                {localize(formatTime(times[p.key], lang))}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function white(alpha: number): string {
  return `rgba(255, 255, 255, ${alpha})`;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, gap: 14 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  topStacked: { gap: 8 },
  headline: { flexShrink: 1, minWidth: 0 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  big: { fontWeight: '900', marginTop: 2 },
  countdownInline: { alignItems: 'flex-end', flexShrink: 0 },
  countdownStacked: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  cdLabel: { fontSize: 11, fontWeight: '700' },
  cdValue: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 1 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  chipName: { fontSize: 12, fontWeight: '800' },
  chipTime: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});
```

Note: `kicker` gained `textTransform: 'uppercase'` — the translated strings (`banner.currentWindow` etc.) are stored in sentence case now, and this style keeps the visual all-caps look for English (a no-op for Arabic, which has no case).

- [ ] **Step 2: Typecheck and manually verify**

Run: `npm run typecheck`
Expected: PASS

Run: `npx expo start`.
Expected: on any day, the banner and chip strip work exactly as before in English. On a Friday (or by temporarily passing a Friday `Date` into `prayersFor` at a breakpoint to check, then reverting), the Dhuhr chip and the current/next window both read "Jum'ah" instead of "Dhuhr". In Arabic mode, all of this reads in Arabic with Arabic-Indic digits; also check the horizontal chip scroller by eye — it should feel natural to swipe in RTL (this is React Native's own mirroring, not code this task adds, but confirm it looks right).

- [ ] **Step 3: Commit**

```bash
git add src/components/WindowBanner.tsx
git commit -m "feat(banner): add Jum'ah labeling, translation, and Arabic digits

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: `PrayerTable` — Jum'ah label, translation, digits, RTL fix

**Files:**
- Modify: `src/components/PrayerTable.tsx`

**Interfaces:**
- Consumes: `prayersFor` (Task 2), `useT` (Task 6), `toArabicDigits` (Task 2), `formatTime`/`formatTimeShort` (Task 1 — `formatTimeShort` is unchanged, no `lang` param needed since it has no AM/PM).

No new pure-logic test (this is a component). Verify by running the app.

- [ ] **Step 1: Replace the full contents of `src/components/PrayerTable.tsx`**

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime, formatTimeShort } from '../lib/dates';
import { toArabicDigits } from '../lib/digits';
import { Metrics } from '../lib/layout';
import { prayersFor } from '../lib/prayers';
import { useT } from '../i18n/strings';
import { useAppState } from '../state/AppStateContext';
import { useTheme, withAlpha, type Theme } from '../theme/colors';
import { Marks, PrayerInfo, PrayerKey } from '../types';

type Props = {
  metrics: Metrics;
  myName: string;
  partnerName: string | null;
  myMarks: Marks;
  partnerMarks: Marks;
  times: Record<PrayerKey, Date>;
  currentKey: PrayerKey | null;
  onToggle: (prayer: PrayerKey) => void;
};

/**
 * The dashboard's single source of truth: one card, five prayer rows, and two
 * check columns - yours (tappable) and your partner's (read-only).
 */
export function PrayerTable({
  metrics: m,
  myName,
  partnerName,
  myMarks,
  partnerMarks,
  times,
  currentKey,
  onToggle,
}: Props) {
  const t = useTheme();
  const tr = useT();
  const { config } = useAppState();
  const lang = config.language ?? 'en';
  const localize = (s: string) => (lang === 'ar' ? toArabicDigits(s) : s);
  const prayers = prayersFor(new Date());

  const myDone = prayers.filter((p) => myMarks[p.key] != null).length;
  const theirDone = prayers.filter((p) => partnerMarks[p.key] != null).length;
  const hasPartner = partnerName != null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.surfaceAlt,
          borderColor: t.border,
          padding: m.cardPadding,
          gap: m.rowGap,
        },
      ]}
    >
      <View style={[styles.header, { paddingHorizontal: m.rowPaddingH, gap: m.columnGap }]}>
        <Text style={[styles.headerLabel, { color: t.textDim }]} numberOfLines={1}>
          {tr('prayerTable.header')}
        </Text>

        <ColumnHeading
          t={t}
          width={m.slotWidth}
          name={myName}
          count={localize(`${myDone}/${prayers.length}`)}
          complete={myDone === prayers.length}
        />
        <ColumnHeading
          t={t}
          width={m.slotWidth}
          name={partnerName ?? '—'}
          count={hasPartner ? localize(`${theirDone}/${prayers.length}`) : ''}
          complete={hasPartner && theirDone === prayers.length}
          muted={!hasPartner}
        />
      </View>

      {prayers.map((prayer) => (
        <PrayerTableRow
          key={prayer.key}
          t={t}
          tr={tr}
          m={m}
          lang={lang}
          localize={localize}
          prayer={prayer}
          scheduledAt={times[prayer.key]}
          isCurrent={currentKey === prayer.key}
          mineAt={myMarks[prayer.key] ?? null}
          theirsAt={partnerMarks[prayer.key] ?? null}
          hasPartner={hasPartner}
          myName={myName}
          partnerName={partnerName}
          onToggle={() => onToggle(prayer.key)}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */

function ColumnHeading({
  t,
  width,
  name,
  count,
  complete,
  muted = false,
}: {
  t: Theme;
  width: number;
  name: string;
  count: string;
  complete: boolean;
  muted?: boolean;
}) {
  return (
    <View style={[styles.slot, { width }]}>
      <Text
        style={[styles.headerName, { color: muted ? t.textDim : t.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {name}
      </Text>
      {count ? (
        <Text style={[styles.headerCount, { color: complete ? t.primary : t.textDim }]}>
          {count}
        </Text>
      ) : null}
    </View>
  );
}

type T = (key: string, vars?: Record<string, string | number>) => string;

function PrayerTableRow({
  t,
  tr,
  m,
  lang,
  localize,
  prayer,
  scheduledAt,
  isCurrent,
  mineAt,
  theirsAt,
  hasPartner,
  myName,
  partnerName,
  onToggle,
}: {
  t: Theme;
  tr: T;
  m: Metrics;
  lang: 'en' | 'ar';
  localize: (s: string) => string;
  prayer: PrayerInfo;
  scheduledAt: Date;
  isCurrent: boolean;
  mineAt: number | null;
  theirsAt: number | null;
  hasPartner: boolean;
  myName: string;
  partnerName: string | null;
  onToggle: () => void;
}) {
  const mine = mineAt != null;
  // Arabic mode shows the Arabic name alone; English mode keeps the existing
  // English-primary / Arabic-secondary dual display (space permitting).
  const primaryName = lang === 'ar' ? prayer.ar : prayer.en;
  const accessibilityName = primaryName;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: mine
            ? withAlpha(t.primary, t.mode === 'dark' ? 0.14 : 0.08)
            : t.surface,
          borderColor: isCurrent ? t.accent : t.border,
          borderStartWidth: isCurrent ? 3 : StyleSheet.hairlineWidth,
          paddingHorizontal: m.rowPaddingH,
          paddingVertical: m.rowPaddingV,
          gap: m.columnGap,
        },
      ]}
    >
      <View style={styles.nameCell}>
        <Text style={[styles.nameEn, { color: t.text }]} numberOfLines={2}>
          {primaryName}
          {lang === 'en' && m.showArabic ? (
            <Text style={[styles.nameAr, { color: t.textDim }]}>{`  ${prayer.ar}`}</Text>
          ) : null}
        </Text>
        <Text style={[styles.meta, { color: t.textDim }]} numberOfLines={1}>
          {localize(formatTime(scheduledAt, lang))}
          {isCurrent ? (
            <Text style={[styles.now, { color: t.accent }]}>{`   ·   ${tr('prayerTable.now')}`}</Text>
          ) : null}
        </Text>
      </View>

      <CheckSlot
        t={t}
        m={m}
        localize={localize}
        checked={mine}
        at={mineAt}
        editable
        onPress={onToggle}
        label={`${accessibilityName}, ${myName}`}
        stateLabel={mine ? tr('prayerTable.completed') : tr('prayerTable.notCompleted')}
      />
      <CheckSlot
        t={t}
        m={m}
        localize={localize}
        checked={theirsAt != null}
        at={theirsAt}
        editable={false}
        muted={!hasPartner}
        label={
          hasPartner
            ? `${accessibilityName}, ${partnerName}`
            : `${accessibilityName}, ${tr('prayerTable.nobodyJoinedYet')}`
        }
        stateLabel={theirsAt != null ? tr('prayerTable.completed') : tr('prayerTable.notCompleted')}
      />
    </View>
  );
}

function CheckSlot({
  t,
  m,
  localize,
  checked,
  at,
  editable,
  onPress,
  muted = false,
  label,
  stateLabel,
}: {
  t: Theme;
  m: Metrics;
  localize: (s: string) => string;
  checked: boolean;
  at: number | null;
  editable: boolean;
  onPress?: () => void;
  muted?: boolean;
  label: string;
  stateLabel: string;
}) {
  const box = (
    <View
      style={[
        styles.box,
        {
          width: m.boxSize,
          height: m.boxSize,
          borderColor: checked ? t.primary : t.border,
          backgroundColor: checked ? t.primary : 'transparent',
          borderStyle: editable ? 'solid' : 'dashed',
          opacity: muted ? 0.35 : 1,
        },
      ]}
    >
      {checked ? (
        <Text style={[styles.check, { color: t.onPrimary, fontSize: m.checkFontSize }]}>✓</Text>
      ) : null}
    </View>
  );

  const stamp =
    m.showStamp && checked && at != null ? (
      <Text style={[styles.stamp, { color: t.primary }]} numberOfLines={1}>
        {localize(formatTimeShort(new Date(at)))}
      </Text>
    ) : null;

  if (!editable) {
    return (
      <View
        style={[styles.slot, { width: m.slotWidth }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label}: ${stateLabel}`}
      >
        {box}
        {stamp}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.slot,
        { width: m.slotWidth, opacity: pressed ? 0.55 : 1 },
      ]}
    >
      {box}
      {stamp}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  headerLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  headerName: { fontSize: 13, fontWeight: '800' },
  headerCount: { fontSize: 11, fontWeight: '700', marginTop: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  nameCell: { flex: 1, minWidth: 0 },
  nameEn: { fontSize: 15, fontWeight: '700' },
  nameAr: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  now: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },

  slot: { alignItems: 'center', justifyContent: 'center' },
  box: {
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontWeight: '900' },
  stamp: { fontSize: 9, fontWeight: '800', marginTop: 3 },
});
```

Note: `borderLeftWidth` became `borderStartWidth` on the row (the RTL fix from the design doc); `headerLabel` and `now` gained `textTransform: 'uppercase'` to keep their visual all-caps look now that the underlying strings (`prayerTable.header`, `prayerTable.now`) are stored in sentence case.

- [ ] **Step 2: Typecheck and manually verify**

Run: `npm run typecheck`
Expected: PASS

Run: `npx expo start`.
Expected: everything looks and behaves as before in English. In Arabic mode: prayer names show in Arabic only (no dual English/Arabic line), the count badges (`3/5`) show Arabic-Indic digits, the current-row accent stripe sits on the right edge (the RTL leading edge) instead of the left, and a screen reader (or `read_page`-style inspection) reports the translated completed/not-completed state.

- [ ] **Step 3: Commit**

```bash
git add src/components/PrayerTable.tsx
git commit -m "feat(prayer-table): add Jum'ah labeling, translation, digits, RTL fix

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: `SettingsModal` — language, Hijri offset, Reports nav, translation

**Files:**
- Modify: `src/screens/SettingsModal.tsx`
- Modify: `src/screens/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `LanguageSwitch` (Task 9), `useT` (Task 6), `toHijri`/`formatHijri` (Task 3), `toArabicDigits` (Task 2), `config.hijriOffset` (Task 7).
- Produces: `SettingsModal` gains two new required props, `onOpenWeeklyStats: () => void` and `onOpenMonthlyReport: () => void`. `DashboardScreen`'s settings-open boolean becomes a 3-way overlay (`'none' | 'settings' | 'weekly' | 'monthly'`) that Tasks 16–17 will plug their screens into.
- **City names, country names, and calculation-method labels (`CITIES`, `METHODS` in `src/services/cities.ts` / `src/config/constants.ts`) are deliberately left untranslated** — they are proper nouns and institution names (e.g. "Umm al-Qura, Makkah", "Cairo, Egypt"), not UI chrome, and translating ~49 cities and 12 methods is out of scope for this release.

No new pure-logic test (this is a screen). Verify by running the app.

- [ ] **Step 1: Replace the full contents of `src/screens/SettingsModal.tsx`**

```tsx
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  I18nManager,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { TextField } from '../components/TextField';
import { APP_VERSION, METHODS, NAME_MAX_LENGTH } from '../config/constants';
import { toArabicDigits } from '../lib/digits';
import { tapFeedback } from '../lib/haptics';
import { formatHijri, toHijri } from '../lib/hijri';
import { useT } from '../i18n/strings';
import { CITIES, findCity } from '../services/cities';
import { detectCoords } from '../services/location';
import { useAppState } from '../state/AppStateContext';
import { useTheme, type Theme } from '../theme/colors';
import { LocationMode, Madhab, MethodKey } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  myName: string;
  code: string | null;
  onRename: (name: string) => Promise<void>;
  onLeave: () => Promise<void>;
  onOpenWeeklyStats: () => void;
  onOpenMonthlyReport: () => void;
};

export function SettingsModal({
  visible,
  onClose,
  myName,
  code,
  onRename,
  onLeave,
  onOpenWeeklyStats,
  onOpenMonthlyReport,
}: Props) {
  const t = useTheme();
  const tr = useT();
  const { config, update } = useAppState();
  const lang = config.language ?? 'en';
  const localize = (s: string) => (lang === 'ar' ? toArabicDigits(s) : s);

  const [name, setName] = useState(myName);
  const [savingName, setSavingName] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (visible) setName(myName);
  }, [visible, myName]);

  async function handleSaveName() {
    const trimmed = name.trim() || 'Me';
    setSavingName(true);
    try {
      await onRename(trimmed);
      tapFeedback('success');
    } catch {
      Alert.alert(tr('settings.saveFailedTitle'), tr('settings.saveFailedBody'));
    } finally {
      setSavingName(false);
    }
  }

  async function handleCopyCode() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    tapFeedback('success');
  }

  async function handleShareCode() {
    if (!code) return;
    try {
      await Share.share({
        message: tr('dashboard.shareMessage', { appName: tr('common.appName'), code }),
      });
    } catch {
      // user dismissed the share sheet
    }
  }

  async function handleDetect() {
    setDetecting(true);
    try {
      const result = await detectCoords();
      if (result.ok) {
        update({ coords: result.coords, locationMode: 'gps', dismissedLocationHint: true });
        tapFeedback('success');
      } else {
        Alert.alert(
          tr('dashboard.locationUnavailableTitle'),
          result.reason === 'denied' ? tr('settings.locationDeniedBody') : tr('settings.locationErrorBody'),
        );
      }
    } finally {
      setDetecting(false);
    }
  }

  function confirmLeave() {
    Alert.alert(tr('settings.leaveConfirmTitle'), tr('settings.leaveConfirmBody'), [
      { text: tr('common.cancel'), style: 'cancel' },
      { text: tr('settings.leave'), style: 'destructive', onPress: () => void onLeave() },
    ]);
  }

  const city = findCity(config.cityId);
  const hijriPreview = localize(formatHijri(toHijri(new Date(), config.hijriOffset), lang));

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.head, { borderBottomColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>{tr('settings.title')}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.done, { color: t.primary }]}>{tr('common.done')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Section t={t} title={tr('settings.sectionLanguage')} hint={tr('settings.languageHint')}>
            <LanguageSwitch />
          </Section>

          <Section t={t} title={tr('settings.sectionDisplayName')}>
            <TextField
              value={name}
              onChangeText={setName}
              maxLength={NAME_MAX_LENGTH}
              placeholder={tr('settings.namePlaceholder')}
              autoCapitalize="words"
            />
            <Button label={tr('settings.saveName')} onPress={handleSaveName} loading={savingName} />
          </Section>

          <Section t={t} title={tr('settings.sectionRoomCode')} hint={tr('settings.roomCodeHint')}>
            <View style={[styles.codeBox, { borderColor: t.border, backgroundColor: t.surface }]}>
              <Text style={[styles.code, styles.ltr, { color: t.text }]}>{code ?? '—'}</Text>
            </View>
            <View style={styles.rowGap}>
              <Button label={tr('common.copy')} variant="secondary" style={styles.grow} onPress={handleCopyCode} />
              <Button label={tr('common.share')} variant="secondary" style={styles.grow} onPress={handleShareCode} />
            </View>
          </Section>

          <Section t={t} title={tr('settings.sectionLocation')}>
            <Segmented<LocationMode>
              t={t}
              value={config.locationMode}
              onChange={(mode) => update({ locationMode: mode })}
              options={[
                { key: 'gps', label: tr('settings.useGps') },
                { key: 'manual', label: tr('settings.pickACity') },
              ]}
            />

            {config.locationMode === 'gps' ? (
              <View style={styles.stack}>
                <Text style={[styles.hint, { color: t.textDim }]}>
                  {config.coords
                    ? tr('settings.usingCoords', {
                        lat: config.coords.lat.toFixed(3),
                        lng: config.coords.lng.toFixed(3),
                      })
                    : tr('settings.locationNotSet')}
                </Text>
                <Button
                  label={tr('settings.detectLocation')}
                  variant="secondary"
                  loading={detecting}
                  onPress={handleDetect}
                />
              </View>
            ) : (
              <OptionList
                t={t}
                value={config.cityId}
                onChange={(id) => {
                  const picked = findCity(id);
                  update({ cityId: id, method: picked.method });
                }}
                options={CITIES.map((c) => ({ key: c.id, label: c.name, note: c.country }))}
              />
            )}
            {config.locationMode === 'manual' ? (
              <Text style={[styles.hint, { color: t.textDim }]}>
                {tr('settings.cityCalculatedFor', { city: city.name, country: city.country })}
              </Text>
            ) : null}
          </Section>

          <Section t={t} title={tr('settings.sectionMethod')}>
            <OptionList<MethodKey>
              t={t}
              value={config.method}
              onChange={(key) => update({ method: key })}
              options={METHODS.map((mm) => ({ key: mm.key, label: mm.label, note: mm.note }))}
            />
          </Section>

          <Section t={t} title={tr('settings.sectionAsr')}>
            <Segmented<Madhab>
              t={t}
              value={config.madhab}
              onChange={(madhab) => update({ madhab })}
              options={[
                { key: 'shafi', label: tr('settings.asrStandard') },
                { key: 'hanafi', label: tr('settings.asrHanafi') },
              ]}
            />
            <Text style={[styles.hint, { color: t.textDim }]}>{tr('settings.asrHint')}</Text>
          </Section>

          <Section t={t} title={tr('settings.sectionHijri')} hint={tr('settings.hijriOffsetHint')}>
            <View style={[styles.stepperRow, { borderColor: t.border, backgroundColor: t.surface }]}>
              <Pressable
                onPress={() => update({ hijriOffset: Math.max(-2, config.hijriOffset - 1) })}
                style={styles.stepperBtn}
                accessibilityRole="button"
                accessibilityLabel="-1"
              >
                <Text style={[styles.stepperBtnText, { color: t.text }]}>−</Text>
              </Pressable>
              <View style={styles.stepperCenter}>
                <Text style={[styles.stepperValue, { color: t.text }]}>
                  {config.hijriOffset > 0 ? `+${config.hijriOffset}` : String(config.hijriOffset)}
                </Text>
                <Text style={[styles.stepperPreview, { color: t.textDim }]} numberOfLines={1}>
                  {hijriPreview}
                </Text>
              </View>
              <Pressable
                onPress={() => update({ hijriOffset: Math.min(2, config.hijriOffset + 1) })}
                style={styles.stepperBtn}
                accessibilityRole="button"
                accessibilityLabel="+1"
              >
                <Text style={[styles.stepperBtnText, { color: t.text }]}>+</Text>
              </Pressable>
            </View>
          </Section>

          <Section t={t} title={tr('settings.sectionReports')}>
            <NavRow t={t} label={tr('settings.weeklyStats')} onPress={onOpenWeeklyStats} />
            <NavRow t={t} label={tr('settings.monthlyReport')} onPress={onOpenMonthlyReport} />
          </Section>

          <Section t={t} title={tr('settings.sectionDanger')}>
            <Button label={tr('settings.leaveRoom')} variant="danger" onPress={confirmLeave} />
          </Section>

          <Text style={[styles.version, { color: t.textDim }]}>
            {tr('settings.versionLabel', { appName: tr('common.appName'), version: APP_VERSION })}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Local building blocks                                               */
/* ------------------------------------------------------------------ */

function Section({
  t,
  title,
  hint,
  children,
}: {
  t: Theme;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.textDim }]}>{title.toUpperCase()}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: t.textDim }]}>{hint}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Segmented<T extends string>({
  t,
  value,
  onChange,
  options,
}: {
  t: Theme;
  value: T;
  onChange: (value: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: t.surface, borderColor: t.border }]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.segment, active && { backgroundColor: t.primary }]}
          >
            <Text style={[styles.segmentLabel, { color: active ? t.onPrimary : t.text }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OptionList<T extends string>({
  t,
  value,
  onChange,
  options,
}: {
  t: Theme;
  value: T;
  onChange: (value: T) => void;
  options: { key: T; label: string; note?: string }[];
}) {
  return (
    <View style={[styles.optionList, { borderColor: t.border, backgroundColor: t.surface }]}>
      {options.map((opt, index) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.option,
              index > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, { color: t.text }]}>{opt.label}</Text>
              {opt.note ? <Text style={[styles.optionNote, { color: t.textDim }]}>{opt.note}</Text> : null}
            </View>
            <View
              style={[
                styles.radio,
                { borderColor: active ? t.primary : t.border },
                active && { backgroundColor: t.primary },
              ]}
            >
              {active ? <Text style={[styles.radioDot, { color: t.onPrimary }]}>✓</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function NavRow({ t, label, onPress }: { t: Theme; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.navRow, { borderColor: t.border, backgroundColor: t.surface }]}
    >
      <Text style={[styles.navRowLabel, { color: t.text }]}>{label}</Text>
      <Text
        style={[
          styles.navRowChevron,
          { color: t.textDim, transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] },
        ]}
      >
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '800' },
  done: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20, gap: 26, paddingBottom: 48 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  sectionHint: { fontSize: 12, marginTop: -2 },
  sectionBody: { gap: 10, marginTop: 2 },
  stack: { gap: 10 },
  hint: { fontSize: 12 },
  rowGap: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  // The room code is always Western digits, left-to-right, in both languages.
  ltr: { writingDirection: 'ltr' },
  codeBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  code: { fontSize: 30, fontWeight: '900', letterSpacing: 10 },
  segmented: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentLabel: { fontSize: 14, fontWeight: '700' },
  optionList: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 14, fontWeight: '700' },
  optionNote: { fontSize: 12, marginTop: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { fontSize: 12, fontWeight: '900' },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
  },
  stepperBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepperBtnText: { fontSize: 20, fontWeight: '800' },
  stepperCenter: { flex: 1, alignItems: 'center', gap: 2 },
  stepperValue: { fontSize: 16, fontWeight: '800' },
  stepperPreview: { fontSize: 12 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  navRowLabel: { fontSize: 14, fontWeight: '700' },
  navRowChevron: { fontSize: 18, fontWeight: '700' },
  version: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
```

- [ ] **Step 2: Update `DashboardScreen.tsx` to a 3-way overlay and pass the new props**

In `src/screens/DashboardScreen.tsx`, replace:

```tsx
  const [settingsOpen, setSettingsOpen] = useState(false);
```

with:

```tsx
  const [overlay, setOverlay] = useState<'none' | 'settings' | 'weekly' | 'monthly'>('none');
```

Replace the gear button's `onPress`:

```tsx
            onPress={() => setOverlay('settings')}
```

Replace the `LocationHint`'s `onPickCity`:

```tsx
            onPickCity={() => setOverlay('settings')}
```

Replace the `<SettingsModal ... />` block at the bottom with:

```tsx
      <SettingsModal
        visible={overlay === 'settings'}
        onClose={() => setOverlay('none')}
        myName={myName}
        code={config.roomId}
        onRename={async (name) => {
          await rename(name);
          update({ displayName: name });
        }}
        onLeave={async () => {
          await leave();
          update({ roomId: null });
          setOverlay('none');
        }}
        onOpenWeeklyStats={() => setOverlay('weekly')}
        onOpenMonthlyReport={() => setOverlay('monthly')}
      />
```

At this point `overlay === 'weekly'`/`'monthly'` render nothing extra — Tasks 16 and 17 each add one line rendering their screen for that state. Tapping "Weekly stats" or "Monthly report" right now will simply close Settings; that's expected until those tasks land, not a bug in this one.

- [ ] **Step 3: Typecheck and manually verify**

Run: `npm run typecheck`
Expected: PASS

Run: `npx expo start`, open Settings.
Expected: a Language section at the top (switching it reloads the app, as in Task 9); a Hijri date section with a working −/+ stepper (−2..+2) and a live preview that updates as you tap; a Reports section with "Weekly stats" and "Monthly report" rows that currently just close the sheet; the room code box stays Western-digit and left-to-right in Arabic mode; every other section reads correctly in both languages.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SettingsModal.tsx src/screens/DashboardScreen.tsx
git commit -m "feat(settings): add language section, Hijri offset, Reports nav, translation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 14: Firestore rules — edit window and `list` for the days range query

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Consumes: `y`/`m`/`d` fields on every day-doc write (Task 8).
- Produces: `days/{day}` now allows `list` (needed by Task 15's range query) and rejects any create/update whose `y`/`m`/`d` puts it outside roughly the last 7 days.

No local emulator exists in this project — the real check is deploying to the live project, which validates the rules language server-side.

- [ ] **Step 1: Update the schema comment**

Replace the file's header comment:

```
// Yalla Salah — Firestore security rules
//
// Model
//   rooms/{code}              code == 6-digit string, IS the document id
//     createdAt : timestamp
//     slots     : { a: <uid>|null, b: <uid>|null }   // the two members
//     names     : { <uid>: string }                  // display names
//
//   rooms/{code}/days/{YYYY-MM-DD}
//     updatedAt : timestamp
//     y, m, d   : int                                // the date this doc represents
//     marks     : { <uid>: { fajr|dhuhr|asr|maghrib|isha: <epoch-ms>|null } }
//
// The 6-digit code is a shared secret: any signed-in (anonymous) user who knows
// it can read the room and claim one of its two slots. Once both slots are
// taken, no third party can write. A member may only ever change their OWN
// slot / name / marks. Writes to a day doc are further limited to roughly the
// last 7 days (see withinEditWindow below), for the weekly/monthly reports'
// "fix a forgotten tick" feature.
```

- [ ] **Step 2: Replace the `days/{day}` match block**

Replace the entire `match /days/{day} { ... }` block with:

```
      match /days/{day} {
        function dayMember() {
          let path = /databases/$(database)/documents/rooms/$(code);
          let room = exists(path) ? get(path).data : null;
          return signedIn()
            && room != null
            && (room.slots.a == request.auth.uid || room.slots.b == request.auth.uid);
        }
        function validDay() {
          return day.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
        }
        function marksShape() {
          return request.resource.data.keys().hasOnly(['marks', 'updatedAt', 'y', 'm', 'd']);
        }
        function validDayFields() {
          let data = request.resource.data;
          return data.y is int && data.y > 2000 && data.y < 2100
            && data.m is int && data.m >= 1 && data.m <= 12
            && data.d is int && data.d >= 1 && data.d <= 31;
        }
        // The weekly/monthly reports let you fix a forgotten tick on one of
        // the last ~7 days. Rules only see server time, but a day key is the
        // *device's* local date, so this is deliberately a little wider than
        // exactly 7 days (a day of slack on each side for timezone drift) --
        // consistent with this app's "trust the two people who know the
        // code" security model (see the design doc's known trade-offs).
        function withinEditWindow() {
          let data = request.resource.data;
          let target = timestamp.date(data.y, data.m, data.d);
          return request.time > target - duration.value(1, 'd')
            && request.time < target + duration.value(9, 'd');
        }

        allow get: if dayMember();
        allow list: if dayMember();

        allow create: if dayMember()
          && validDay()
          && marksShape()
          && validDayFields()
          && withinEditWindow()
          && request.resource.data.marks.keys().hasOnly([request.auth.uid]);

        allow update: if dayMember()
          && validDay()
          && marksShape()
          && validDayFields()
          && withinEditWindow()
          && request.resource.data.marks
               .diff(resource.data.marks)
               .affectedKeys()
               .hasOnly([request.auth.uid]);

        allow delete: if false;
      }
```

(`allow list: if dayMember();` is the other change here — Task 15's range query across `rooms/{code}/days` is a Firestore "list" request, which the old `allow list: if false;` would reject outright, independent of any per-document rule.)

- [ ] **Step 3: Deploy and verify**

Run: `npm run deploy:rules`
Expected: `firebase-tools` prints `✔ cloud.firestore: rules file firestore.rules compiled successfully` and `✔ Deploy complete!`. A syntax mistake in the rules (e.g. a typo in `timestamp.date` or `duration.value`) surfaces here as a compile error — fix and redeploy if so.

Manually, in the running app: tap a prayer today (should still work), then — once Task 16 exists — try editing a day 9+ days back and confirm Firestore rejects it with a permission error while a day 3–6 days back succeeds.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): add the day-edit window and allow list on days/

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 15: `useDayRange` — live range query over a room's days

**Files:**
- Create: `src/state/useDayRange.ts`

**Interfaces:**
- Produces: `useDayRange(roomId: string | null, startKey: string, endKey: string): { days: Record<string, DayDoc>; loading: boolean; error: string | null }`. Consumed by Tasks 16 and 17.

No new pure-logic test — this is a Firestore-dependent hook, matching `useRoomSync.ts`'s existing untested status. It is exercised end-to-end once Task 16 renders a screen with it.

- [ ] **Step 1: Implement**

Create `src/state/useDayRange.ts`:

```ts
import { collection, documentId, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '../config/firebase';
import { DayDoc } from '../types';

export type DayRange = {
  days: Record<string, DayDoc>;
  loading: boolean;
  error: string | null;
};

/**
 * Live query over `rooms/{roomId}/days` for every day key in the inclusive
 * range `[startKey, endKey]` (both `YYYY-MM-DD`) — day keys already sort
 * lexicographically, so this is one range query with no composite index.
 * Used by the weekly stats and monthly report screens.
 */
export function useDayRange(roomId: string | null, startKey: string, endKey: string): DayRange {
  const [days, setDays] = useState<Record<string, DayDoc>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setDays({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'rooms', roomId, 'days'),
      where(documentId(), '>=', startKey),
      where(documentId(), '<=', endKey),
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, DayDoc> = {};
        snap.forEach((docSnap) => {
          next[docSnap.id] = docSnap.data() as DayDoc;
        });
        setDays(next);
        setLoading(false);
        setError(null);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [roomId, startKey, endKey]);

  return { days, loading, error };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/state/useDayRange.ts
git commit -m "feat(reports): add useDayRange live range-query hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 16: `WeeklyStatsScreen`

**Files:**
- Create: `src/screens/WeeklyStatsScreen.tsx`
- Modify: `src/screens/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `useDayRange` (Task 15), `computeStats` (Task 4), `addDays`/`isWithinEditWindow`/`humanDate` (Task 1), `prayersFor` (Task 2), `toggleMark` (Task 8), `useT` (Task 6).
- Produces: `<WeeklyStatsScreen visible onClose roomId uid partnerUid myName partnerName today />`, rendered by `DashboardScreen` when `overlay === 'weekly'`. Also produces the shared `DayMarksEditor` component (`Dot`, `countDone`, `DayEditor`), which Task 17's monthly report reuses rather than duplicating.

No new pure-logic test (this is a screen; every pure function it calls already has its own tests). Verify by running the app.

- [ ] **Step 1: Create the shared per-day editor component**

Create `src/components/DayMarksEditor.tsx` (the "tap a day, toggle its 5 prayers" UI shared by the weekly and monthly report screens):

```tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { prayersFor } from '../lib/prayers';
import { useTheme } from '../theme/colors';
import { Marks, PrayerKey } from '../types';

export function countDone(marks: Marks | undefined): number {
  if (!marks) return 0;
  return Object.values(marks).filter((v) => v != null).length;
}

export function Dot({ filled, muted = false }: { filled: boolean; muted?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        styles.dot,
        { backgroundColor: filled ? t.primary : 'transparent', borderColor: t.border, opacity: muted ? 0.5 : 1 },
      ]}
    />
  );
}

/** One day's 5 prayers as tappable rows, editing only the current user's own marks. */
export function DayEditor({
  lang,
  dayDate,
  marks,
  onToggle,
}: {
  lang: 'en' | 'ar';
  dayDate: Date;
  marks: Marks;
  onToggle: (prayer: PrayerKey, currentlyDone: boolean) => void;
}) {
  const t = useTheme();
  const prayers = prayersFor(dayDate);
  return (
    <View style={[styles.editor, { backgroundColor: t.surfaceAlt }]}>
      {prayers.map((p) => {
        const done = marks[p.key] != null;
        return (
          <Pressable key={p.key} onPress={() => onToggle(p.key, done)} style={styles.editorRow}>
            <Text style={[styles.editorLabel, { color: t.text }]}>{lang === 'ar' ? p.ar : p.en}</Text>
            <View
              style={[
                styles.editorBox,
                { borderColor: done ? t.primary : t.border, backgroundColor: done ? t.primary : 'transparent' },
              ]}
            >
              {done ? <Text style={[styles.editorCheck, { color: t.onPrimary }]}>✓</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 12, height: 12, borderRadius: 999, borderWidth: 1.5 },
  editor: { paddingHorizontal: 14, paddingVertical: 8, gap: 4 },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  editorLabel: { fontSize: 13, fontWeight: '600' },
  editorBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorCheck: { fontWeight: '900', fontSize: 12 },
});
```

- [ ] **Step 2: Create the screen**

Create `src/screens/WeeklyStatsScreen.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { countDone, DayEditor, Dot } from '../components/DayMarksEditor';
import { addDays, humanDate, isWithinEditWindow } from '../lib/dates';
import { toArabicDigits } from '../lib/digits';
import { computeStats } from '../lib/stats';
import { useT } from '../i18n/strings';
import { useAppState } from '../state/AppStateContext';
import { useDayRange } from '../state/useDayRange';
import { toggleMark } from '../state/useRoomSync';
import { useTheme, type Theme } from '../theme/colors';
import { Marks } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  roomId: string | null;
  uid: string;
  partnerUid: string | null;
  myName: string;
  partnerName: string | null;
  today: string;
};

export function WeeklyStatsScreen({
  visible,
  onClose,
  roomId,
  uid,
  partnerUid,
  myName,
  partnerName,
  today,
}: Props) {
  const t = useTheme();
  const tr = useT();
  const { config } = useAppState();
  const lang = config.language ?? 'en';
  const localize = (s: string) => (lang === 'ar' ? toArabicDigits(s) : s);

  const startKey = addDays(today, -6);
  const { days } = useDayRange(roomId, startKey, today);

  const dayKeys = useMemo(() => {
    const keys: string[] = [];
    for (let i = 6; i >= 0; i -= 1) keys.push(addDays(today, -i));
    return keys;
  }, [today]);

  const myMarksByDay = useMemo(() => {
    const out: Record<string, Marks | undefined> = {};
    for (const key of dayKeys) out[key] = days[key]?.marks?.[uid];
    return out;
  }, [dayKeys, days, uid]);

  const partnerMarksByDay = useMemo(() => {
    const out: Record<string, Marks | undefined> = {};
    for (const key of dayKeys) out[key] = partnerUid ? days[key]?.marks?.[partnerUid] : undefined;
    return out;
  }, [dayKeys, days, partnerUid]);

  const myStats = computeStats(myMarksByDay);
  const partnerStats = partnerUid ? computeStats(partnerMarksByDay) : null;

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.head, { borderBottomColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>{tr('settings.weeklyStats')}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.done, { color: t.primary }]}>{tr('common.done')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.sectionLabel, { color: t.textDim }]}>{tr('reports.last7Days')}</Text>

          <View style={styles.summaryRow}>
            <SummaryCard t={t} localize={localize} name={myName} stats={myStats} />
            {partnerStats ? (
              <SummaryCard t={t} localize={localize} name={partnerName ?? '—'} stats={partnerStats} />
            ) : null}
          </View>

          <View style={[styles.list, { borderColor: t.border, backgroundColor: t.surface }]}>
            {dayKeys.map((key, index) => {
              const editable = isWithinEditWindow(key, today);
              const expanded = expandedDay === key;
              const [y, m, d] = key.split('-').map(Number);
              const dayDate = new Date(y, m - 1, d);

              return (
                <View key={key}>
                  <Pressable
                    disabled={!editable}
                    onPress={() => setExpandedDay(expanded ? null : key)}
                    style={[
                      styles.dayRow,
                      index > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth },
                      { opacity: editable ? 1 : 0.6 },
                    ]}
                  >
                    <Text style={[styles.dayLabel, { color: t.text }]}>
                      {localize(humanDate(dayDate, lang))}
                    </Text>
                    <View style={styles.dayDots}>
                      <Dot filled={countDone(myMarksByDay[key]) === 5} />
                      {partnerUid ? <Dot filled={countDone(partnerMarksByDay[key]) === 5} muted /> : null}
                    </View>
                  </Pressable>
                  {expanded ? (
                    <DayEditor
                      lang={lang}
                      dayDate={dayDate}
                      marks={myMarksByDay[key] ?? {}}
                      onToggle={(prayer, done) => {
                        if (!roomId) return;
                        void toggleMark(roomId, uid, key, prayer, done);
                      }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
          <Text style={[styles.editableHint, { color: t.textDim }]}>{tr('reports.editableHint')}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SummaryCard({
  t,
  localize,
  name,
  stats,
}: {
  t: Theme;
  localize: (s: string) => string;
  name: string;
  stats: ReturnType<typeof computeStats>;
}) {
  const pct = stats.totalPossible > 0 ? Math.round((stats.totalDone / stats.totalPossible) * 100) : 0;
  return (
    <View style={[styles.summaryCard, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
      <Text style={[styles.summaryName, { color: t.text }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.summaryValue, { color: t.primary }]}>
        {localize(`${stats.totalDone}/${stats.totalPossible}`)}
      </Text>
      <Text style={[styles.summaryPct, { color: t.textDim }]}>{localize(`${pct}%`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '800' },
  done: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20, gap: 16, paddingBottom: 48 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4, alignItems: 'center' },
  summaryName: { fontSize: 13, fontWeight: '700' },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryPct: { fontSize: 12, fontWeight: '600' },
  list: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  dayLabel: { fontSize: 14, fontWeight: '700' },
  dayDots: { flexDirection: 'row', gap: 6 },
  editableHint: { fontSize: 12, textAlign: 'center' },
});
```

- [ ] **Step 3: Render it from `DashboardScreen`**

In `src/screens/DashboardScreen.tsx`, add the import:

```ts
import { WeeklyStatsScreen } from './WeeklyStatsScreen';
```

Add, right after the `<SettingsModal ... />` block:

```tsx
      <WeeklyStatsScreen
        visible={overlay === 'weekly'}
        onClose={() => setOverlay('none')}
        roomId={config.roomId}
        uid={uid}
        partnerUid={partnerUid}
        myName={myName}
        partnerName={partnerName}
        today={today}
      />
```

- [ ] **Step 4: Typecheck and manually verify**

Run: `npm run typecheck`
Expected: PASS

Run: `npx expo start`, tap Settings → Weekly stats.
Expected: two summary cards (yours, your partner's if joined) showing a `done/possible · pct%` total for the last 7 days; a 7-row list, oldest to newest, each with a small filled/unfilled dot per person; tapping a day within the last 7 (all of them, right now) expands 5 tappable prayer rows for your own marks — toggling one updates instantly and is reflected back in the dot once you collapse the row. Tapping a day older than 7 days (once more history exists) does nothing, and its row looks dimmed.

- [ ] **Step 5: Commit**

```bash
git add src/components/DayMarksEditor.tsx src/screens/WeeklyStatsScreen.tsx src/screens/DashboardScreen.tsx
git commit -m "feat(reports): add the weekly stats screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 17: `MonthlyReportScreen`

**Files:**
- Create: `src/screens/MonthlyReportScreen.tsx`
- Modify: `src/screens/DashboardScreen.tsx`

**Interfaces:**
- Consumes: `useDayRange` (Task 15), `computeStats` (Task 4), `addDays`/`dayKeyParts` (Task 1), `toHijri`/`hijriMonthRange` (Task 3), `DayEditor`/`Dot`/`countDone` (Task 16), `toggleMark` (Task 8), `useT` (Task 6).
- Produces: `<MonthlyReportScreen visible onClose roomId uid partnerUid myName partnerName today />`, rendered by `DashboardScreen` when `overlay === 'monthly'`.

No new pure-logic test (this is a screen; the month-range math it delegates to — `hijriMonthRange` — already has its own tests). Verify by running the app.

- [ ] **Step 1: Create the screen**

Create `src/screens/MonthlyReportScreen.tsx`:

```tsx
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { countDone, DayEditor, Dot } from '../components/DayMarksEditor';
import { addDays, dayKeyParts, isWithinEditWindow } from '../lib/dates';
import { toArabicDigits } from '../lib/digits';
import { hijriMonthRange, toHijri } from '../lib/hijri';
import { computeStats } from '../lib/stats';
import { useT } from '../i18n/strings';
import { useAppState } from '../state/AppStateContext';
import { useDayRange } from '../state/useDayRange';
import { toggleMark } from '../state/useRoomSync';
import { useTheme, type Theme } from '../theme/colors';
import { Marks } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  roomId: string | null;
  uid: string;
  partnerUid: string | null;
  myName: string;
  partnerName: string | null;
  today: string;
};

type Mode = 'gregorian' | 'hijri';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Adds `offset` months to a Hijri year/month, wrapping the year as needed. */
function shiftHijriMonth(h: { year: number; month: number }, offset: number): { year: number; month: number } {
  const index = (h.year - 1440) * 12 + (h.month - 1) + offset;
  return { year: 1440 + Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 };
}

export function MonthlyReportScreen({
  visible,
  onClose,
  roomId,
  uid,
  partnerUid,
  myName,
  partnerName,
  today,
}: Props) {
  const t = useTheme();
  const tr = useT();
  const { config } = useAppState();
  const lang = config.language ?? 'en';
  const localize = (s: string) => (lang === 'ar' ? toArabicDigits(s) : s);

  const [mode, setMode] = useState<Mode>('gregorian');
  const [monthOffset, setMonthOffset] = useState(0);

  const todayParts = dayKeyParts(today);
  const currentHijri = useMemo(
    () => toHijri(new Date(todayParts.y, todayParts.m - 1, todayParts.d), config.hijriOffset),
    [todayParts.y, todayParts.m, todayParts.d, config.hijriOffset],
  );

  const viewedGregorian = useMemo(() => {
    const d = new Date(todayParts.y, todayParts.m - 1 + monthOffset, 1);
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }, [todayParts.y, todayParts.m, monthOffset]);

  const viewedHijri = useMemo(
    () => shiftHijriMonth({ year: currentHijri.year, month: currentHijri.month }, monthOffset),
    [currentHijri.year, currentHijri.month, monthOffset],
  );

  const range = useMemo(() => {
    if (mode === 'gregorian') {
      const lastDay = new Date(viewedGregorian.y, viewedGregorian.m, 0).getDate();
      return {
        start: `${viewedGregorian.y}-${pad(viewedGregorian.m)}-01`,
        end: `${viewedGregorian.y}-${pad(viewedGregorian.m)}-${pad(lastDay)}`,
      };
    }
    return hijriMonthRange(viewedHijri.year, viewedHijri.month, config.hijriOffset);
  }, [mode, viewedGregorian, viewedHijri, config.hijriOffset]);

  const dayKeys = useMemo(() => {
    const keys: string[] = [];
    let cursor = range.start;
    while (cursor <= range.end) {
      keys.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return keys;
  }, [range.start, range.end]);

  const { days } = useDayRange(roomId, range.start, range.end);

  const myMarksByDay = useMemo(() => {
    const out: Record<string, Marks | undefined> = {};
    for (const key of dayKeys) out[key] = days[key]?.marks?.[uid];
    return out;
  }, [dayKeys, days, uid]);

  const partnerMarksByDay = useMemo(() => {
    const out: Record<string, Marks | undefined> = {};
    for (const key of dayKeys) out[key] = partnerUid ? days[key]?.marks?.[partnerUid] : undefined;
    return out;
  }, [dayKeys, days, partnerUid]);

  const myStats = computeStats(myMarksByDay);
  const partnerStats = partnerUid ? computeStats(partnerMarksByDay) : null;

  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  // hijriMonthRange throws outside the lookup table's ~1440-1500 AH coverage
  // (see Task 3) — guard "previous" in Hijri mode so that can never be
  // reached, rather than catching a thrown error after the fact.
  const canGoPrevious =
    mode !== 'hijri' ||
    (currentHijri.year - 1440) * 12 + (currentHijri.month - 1) + (monthOffset - 1) >= 0;
  const isCurrentMonth = monthOffset === 0;
  const monthLabel =
    mode === 'gregorian'
      ? localize(gregorianMonthLabel(viewedGregorian.y, viewedGregorian.m, lang))
      : localize(`${viewedHijri.month}/${viewedHijri.year}`);

  function switchMode(next: Mode) {
    setMode(next);
    setMonthOffset(0);
    setExpandedDay(null);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.head, { borderBottomColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>{tr('settings.monthlyReport')}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.done, { color: t.primary }]}>{tr('common.done')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={[styles.modeSwitch, { borderColor: t.border }]}>
            <ModeOption t={t} label={tr('reports.gregorian')} active={mode === 'gregorian'} onPress={() => switchMode('gregorian')} />
            <ModeOption t={t} label={tr('reports.hijri')} active={mode === 'hijri'} onPress={() => switchMode('hijri')} />
          </View>

          <View style={styles.monthNav}>
            <Pressable
              onPress={() => setMonthOffset((o) => o - 1)}
              disabled={!canGoPrevious}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={tr('reports.previousMonth')}
            >
              <Text style={[styles.navArrow, { color: canGoPrevious ? t.primary : t.border }]}>‹</Text>
            </Pressable>
            <Text style={[styles.monthLabel, { color: t.text }]}>{monthLabel}</Text>
            <Pressable
              onPress={() => setMonthOffset((o) => o + 1)}
              disabled={isCurrentMonth}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={tr('reports.nextMonth')}
            >
              <Text style={[styles.navArrow, { color: isCurrentMonth ? t.border : t.primary }]}>›</Text>
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <SummaryCard t={t} localize={localize} name={myName} stats={myStats} />
            {partnerStats ? (
              <SummaryCard t={t} localize={localize} name={partnerName ?? '—'} stats={partnerStats} />
            ) : null}
          </View>

          <View style={styles.grid}>
            {dayKeys.map((key) => {
              const editable = isWithinEditWindow(key, today);
              const expanded = expandedDay === key;
              const [y, m, d] = key.split('-').map(Number);
              const dayDate = new Date(y, m - 1, d);
              const dayNumber = mode === 'hijri' ? toHijri(dayDate, config.hijriOffset).day : d;

              return (
                <Pressable
                  key={key}
                  disabled={!editable}
                  onPress={() => setExpandedDay(expanded ? null : key)}
                  style={[
                    styles.cell,
                    { borderColor: t.border, backgroundColor: t.surface, opacity: editable ? 1 : 0.5 },
                  ]}
                >
                  <Text style={[styles.cellNumber, { color: t.text }]}>{localize(String(dayNumber))}</Text>
                  <View style={styles.cellDots}>
                    <Dot filled={countDone(myMarksByDay[key]) === 5} />
                    {partnerUid ? <Dot filled={countDone(partnerMarksByDay[key]) === 5} muted /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {expandedDay ? (
            <DayEditor
              lang={lang}
              dayDate={(() => {
                const [y, m, d] = expandedDay.split('-').map(Number);
                return new Date(y, m - 1, d);
              })()}
              marks={myMarksByDay[expandedDay] ?? {}}
              onToggle={(prayer, done) => {
                if (!roomId) return;
                void toggleMark(roomId, uid, expandedDay, prayer, done);
              }}
            />
          ) : null}

          <Text style={[styles.editableHint, { color: t.textDim }]}>{tr('reports.editableHint')}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const GREGORIAN_MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const GREGORIAN_MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

function gregorianMonthLabel(y: number, m: number, lang: 'en' | 'ar'): string {
  const name = lang === 'ar' ? GREGORIAN_MONTHS_AR[m - 1] : GREGORIAN_MONTHS_EN[m - 1];
  return `${name} ${y}`;
}

function ModeOption({ t, label, active, onPress }: { t: Theme; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.modeOption, active && { backgroundColor: t.primary }]}>
      <Text style={[styles.modeLabel, { color: active ? t.onPrimary : t.text }]}>{label}</Text>
    </Pressable>
  );
}

function SummaryCard({
  t,
  localize,
  name,
  stats,
}: {
  t: Theme;
  localize: (s: string) => string;
  name: string;
  stats: ReturnType<typeof computeStats>;
}) {
  const pct = stats.totalPossible > 0 ? Math.round((stats.totalDone / stats.totalPossible) * 100) : 0;
  return (
    <View style={[styles.summaryCard, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
      <Text style={[styles.summaryName, { color: t.text }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.summaryValue, { color: t.primary }]}>
        {localize(`${stats.totalDone}/${stats.totalPossible}`)}
      </Text>
      <Text style={[styles.summaryPct, { color: t.textDim }]}>{localize(`${pct}%`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '800' },
  done: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20, gap: 16, paddingBottom: 48 },
  modeSwitch: { flexDirection: 'row', alignSelf: 'center', borderRadius: 14, borderWidth: 1, padding: 4, gap: 4 },
  modeOption: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10 },
  modeLabel: { fontSize: 13, fontWeight: '700' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  navArrow: { fontSize: 24, fontWeight: '900', paddingHorizontal: 12 },
  monthLabel: { fontSize: 16, fontWeight: '800', minWidth: 140, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 14, gap: 4, alignItems: 'center' },
  summaryName: { fontSize: 13, fontWeight: '700' },
  summaryValue: { fontSize: 20, fontWeight: '900' },
  summaryPct: { fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: {
    width: 60,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 4,
  },
  cellNumber: { fontSize: 13, fontWeight: '700' },
  cellDots: { flexDirection: 'row', gap: 4 },
  editableHint: { fontSize: 12, textAlign: 'center' },
});
```

Note: the `‹`/`›` month-navigation arrows are plain glyphs (matching the app's existing icon-free style — `⚙︎`, `✓`, `☾`); React Native does not auto-mirror raw Unicode glyphs, but since "previous" and "next" already read correctly by position (left arrow = back, right arrow = forward) in most contexts and this app has no other directional-glyph precedent to match, leave them as-is — this is a minor, deliberately out-of-scope polish item, not a correctness bug.

- [ ] **Step 2: Render it from `DashboardScreen`**

In `src/screens/DashboardScreen.tsx`, add the import:

```ts
import { MonthlyReportScreen } from './MonthlyReportScreen';
```

Add, right after the `<WeeklyStatsScreen ... />` block:

```tsx
      <MonthlyReportScreen
        visible={overlay === 'monthly'}
        onClose={() => setOverlay('none')}
        roomId={config.roomId}
        uid={uid}
        partnerUid={partnerUid}
        myName={myName}
        partnerName={partnerName}
        today={today}
      />
```

- [ ] **Step 3: Typecheck and manually verify**

Run: `npm run typecheck`
Expected: PASS

Run: `npx expo start`, tap Settings → Monthly report.
Expected: a Gregorian/Hijri switch defaulting to Gregorian, showing the current month with the "next month" arrow disabled (can't navigate into the future); a calendar grid of day cells, each with a small dot per person; summary cards above the grid; switching to Hijri re-renders the same month range under the Hijri calendar (day numbers now Hijri) and resets to "this month". Tap a day within the last 7 to expand the same 5-prayer editor used in Weekly stats.

- [ ] **Step 4: Commit**

```bash
git add src/screens/MonthlyReportScreen.tsx src/screens/DashboardScreen.tsx
git commit -m "feat(reports): add the monthly report screen with Hijri/Gregorian toggle

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 18: Version bump, README, full verification, and the APK build

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Modify: `README.md`

**Interfaces:** none — this is the release task. Every prior task's own verification step has already exercised its piece; this task runs the full suite once more, deploys rules one last time (idempotent if Task 14 already deployed successfully), and produces the APK.

- [ ] **Step 1: Bump the version**

In `package.json`, change:

```json
  "version": "1.1.0",
```

to:

```json
  "version": "1.2.0",
```

In `app.json`, change:

```json
    "version": "1.1.0",
```

to:

```json
    "version": "1.2.0",
```

and change:

```json
      "versionCode": 2,
```

to:

```json
      "versionCode": 3,
```

- [ ] **Step 2: Update `README.md`**

Add a new subsection right after the existing "## Responsive behaviour" section (before "## How pairing & sync works"):

```markdown
---

## Language, Hijri date, and reports

- **Language** is a per-device setting (`Settings → Language`, or the same
  toggle on first launch). It defaults to Arabic if the phone's own locale is
  Arabic, English otherwise. Switching it reloads the app once — Android's
  right-to-left layout flag only takes effect after a restart.
- **Hijri date** shows under the Gregorian date on the dashboard, computed
  from a table baked in at build time from Node's own Umm al-Qura calendar
  (`scripts/generate-hijri-table.js` → `src/lib/hijriTable.ts`) — Hermes on
  Android has no calendar data of its own. A `Settings → Hijri date` stepper
  (−2..+2 days) covers local moon-sighting differences.
- **Jum'ah**: Friday's Dhuhr is labelled Jum'ah everywhere in the UI; it is
  still stored as the same `dhuhr` mark.
- **Weekly stats / Monthly report** (`Settings → Reports`) show completion
  totals over the last 7 days or a chosen month (Gregorian or Hijri). Tapping
  a day within the last 7 lets you fix a forgotten tick — both the app and
  the Firestore rules enforce that window (with a little slack for timezone
  drift on the rules side).

If you already deployed `firestore.rules` for an earlier version, redeploy it
after updating to this version — the day-edit-window rule and the `days`
range-query permission are new:

```bash
npm run deploy:rules
```
```

- [ ] **Step 3: Run the full verification suite**

Run: `npm run typecheck`
Expected: PASS

Run: `npm test`
Expected: PASS — every test file from Tasks 1–6 (dates, digits, prayers, hijri, stats, direction, i18n) plus the four pre-existing suites (dates, code, prayerTimes, layout — dates.test.ts now carries both old and new cases).

- [ ] **Step 4: Deploy rules (idempotent) and commit**

Run: `npm run deploy:rules`
Expected: `✔ Deploy complete!` (safe to re-run even if Task 14 already deployed successfully).

```bash
git add package.json app.json README.md
git commit -m "chore(release): bump to v1.2.0, document Hijri/Jum'ah/reports/Arabic

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Push and build the APK**

```bash
git push
npm run build:apk
```

`build:apk` runs `npx --yes eas-cli build --platform android --profile preview` (from the existing `package.json` script) — it prompts for an Expo login the first time (`npx --yes eas-cli login`, or `npm run login:eas`) if this machine hasn't authenticated before. It takes roughly 10–15 minutes; the CLI prints a download URL for the `.apk` when it finishes, or fetch it later with `eas build:list --platform android --limit 1`.

Expected: the build succeeds and produces an installable `.apk` reflecting v1.2.0 with every feature in this plan.

---

## Post-plan note on scope

This plan deliberately leaves two things for later, matching the design doc's stated scope:

- City and country names, and calculation-method labels, stay in their original language (proper nouns / institution names) — see Task 13.
- The Hijri table (Task 3) is exact for 1440–1500 AH (~2018–2077 CE); it falls back to less-precise tabular arithmetic outside that window, and `MonthlyReportScreen` (Task 17) refuses to navigate Hijri months past that boundary rather than risk a crash.
