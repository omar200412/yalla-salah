# Hijri date, Jum'ah, weekly/monthly reports, and Arabic — Design

**Date:** 2026-09-12
**Status:** Approved

## Purpose

Four additions to Yalla Salah, built together as one release:

1. A Hijri date shown alongside the Gregorian one.
2. Friday's Dhuhr row relabelled Jum'ah (still the same `dhuhr` mark).
3. A weekly stats view and a monthly report, with a 7-day window to fix a
   forgotten tick.
4. A full Arabic translation with right-to-left layout, switchable in Settings.

Not in scope: languages beyond English/Arabic, editing days older than the
7-day window, changing the underlying data model for prayer marks.

## Decisions

| Question | Decision |
| --- | --- |
| Hijri calendar source | Node/Hermes' built-in `islamic-umalqura` `Intl` calendar, baked into a lookup table at build time (see below) — no runtime `Intl` dependency, since Hermes on Android does not ship the full ICU data `Intl` needs. |
| Hijri date placement | Second line under the Gregorian date in the dashboard header. Changes at local midnight, like the rest of the app — not at Maghrib. |
| Hijri day adjustment | A per-device −2..+2 day offset in Settings, default 0. |
| Jum'ah | Friday's Dhuhr row/chip/banner label reads "Jum'ah"; storage, rules, and the Firestore data model are unchanged. Applies to both members, no toggle. |
| Past-day editing | Last 7 days only, enforced both in the UI and in Firestore rules (with ~1 day of slack per side for timezone drift against the rules' server-time check). |
| Weekly stats | Rolling 7 days ending today — the same window that is editable. |
| Monthly report | A Hijri/Gregorian toggle; either way, one range query per month, with prev/next navigation restricted to past and current months. |
| Report data access | A single `documentId()` range query per report (day keys already sort lexicographically), no composite index. |
| Arabic scope | The whole app: onboarding, dashboard, settings, and the two new report screens. Language is a per-device setting, defaulting to the phone's own locale on first launch. |
| RTL | Native RTL (`I18nManager.allowRTL`/`forceRTL`) with a one-time reload on switch, not a hand-mirrored layout. |
| Arabic digits | Times, dates, and counts use Arabic-Indic digits (٠-٩) in Arabic mode. The 6-digit room code always stays Western digits (typed, shared, copy-pasted). |
| Arabic tone | Standard Arabic for buttons/settings/errors; colloquial touches for the brand name and short encouragements. |
| Translation mechanism | A hand-written `en`/`ar` string table sharing one TypeScript type (no i18n library) — a missing Arabic key is a compile error. |

## Architecture additions

```
src/lib/hijri.ts        pure: toHijri(date, offset), formatHijri(h), hijriMonthRange(y, m, offset)
src/lib/prayers.ts       pure: prayersFor(date) -> PRAYERS with Friday's dhuhr relabelled Jum'ah
src/lib/stats.ts         pure: computeStats(marksByDay) -> per-person totals, Jum'ah split from Dhuhr
src/lib/digits.ts        pure: toArabicDigits(s)
src/lib/direction.ts     pure: decide whether RTL flags need to change + a reload is needed
src/i18n/strings.ts      en/ar string tables + useT() hook
src/screens/WeeklyStatsScreen.tsx
src/screens/MonthlyReportScreen.tsx
scripts/generate-hijri-table.js   generates the Hijri month-length table from Node's Intl at dev time
```

### Hijri calendar

Node's ICU (`islamic-umalqura`) is used **once, offline**, by
`generate-hijri-table.js`, to produce a compact table checked into
`src/lib/hijriTable.ts`:

- The Gregorian date of 1 Muharram 1440 AH (2018-09-11).
- A hex-encoded bitstring of every month length (29 or 30 days) from 1440 AH
  to 1500 AH (732 months, verified against Node's own calendar — none fall
  outside 29/30) — covering roughly 2018 to 2077.

`toHijri()` walks the table from the epoch date for any date inside that
range. Outside the range (dates before 2018 or after ~2077), it falls back to
the standard Kuwaiti/tabular arithmetic method — slightly less accurate, but
the app never crashes on an out-of-range date, and no user of this app will
hit that range in practice.

### Jum'ah

`prayersFor(date)` returns the same five-entry list as the current global
`PRAYERS`, except on a Friday, where the `dhuhr` entry's labels become
`{ en: "Jum'ah", ar: "الجمعة" }`. `PrayerTable`, `WindowBanner`, and the new
report screens call `prayersFor()` instead of importing `PRAYERS` directly.
The stored key, Firestore shape, and security rules are untouched.

### Weekly stats & monthly report

Both screens are reached from a new "Reports" row in Settings.

- **Weekly stats**: one query for the last 7 day-docs. Shows each person's
  total (e.g. `32/35 · 91%`) and a 7×5 grid (days × prayers) per person.
  Tapping a day opens it in an editable `PrayerTable`.
- **Monthly report**: a Hijri/Gregorian switch at the top. Gregorian uses
  calendar months; Hijri uses `hijriMonthRange()`. One query per month.
  Shows a completion summary per person (Jum'ah counted separately from
  Dhuhr) and a calendar grid with a small per-person mark on each day.
  Only the current and past months are navigable. Days within the last 7
  are tappable/editable; older days are read-only.
- `computeStats()` is the single source of truth for turning a map of
  `{ dayKey: DayDoc }` into these totals, so the two screens (and any future
  one) count the same way.

### Editable window enforcement

Firestore rules gain a day-level check: a write to `days/{day}` is allowed
only if `day` falls within roughly 8 days of the rules' own server-time date
(a day of slack on each side, since day keys are the *device's* local date
but rules only see server time). This is deliberately a little generous
rather than exactly 7 — consistent with this app's existing security model
(trust between the two people who know the room code), documented as a
known trade-off below.

### Arabic / RTL

- **Language setting**: `AppConfig.language: 'en' | 'ar' | null`. `null`
  (fresh installs after this update) is resolved once from
  `I18nManager.getConstants().localeIdentifier` and then persisted.
- **Switching**: `update({ language })` first **awaits** the AsyncStorage
  write (today's `persist()` in `AppStateContext.tsx` is fire-and-forget;
  it becomes awaitable for this path), then `src/lib/direction.ts` decides
  whether `I18nManager.isRTL` already matches the new language. If not, it
  calls `allowRTL`/`forceRTL` and reloads once (`Updates.reloadAsync()` in
  the built app, `DevSettings.reload()` in dev).
- **Startup check**: the same `direction.ts` function runs once after config
  loads, to catch a phone that launches in Arabic RTL before any manual
  switch. A persisted "already reloaded for this language" flag stops a
  reload loop if the OS-level flags can't be changed (e.g. some Android
  restrictions); the app still renders, just without perfect mirroring, in
  that rare case.
- **Strings**: `src/i18n/strings.ts` exports `en` and types `ar: typeof en`,
  so every screen's copy is covered and a missing translation fails the
  typecheck. `useT()` reads `config.language`.
- **Digits**: `toArabicDigits()` is applied at each display site (formatted
  times, the countdown, the Hijri date, the `x/5` counts) only in Arabic
  mode. The room code (typed, copied, shared) is exempt everywhere.
- **RTL layout fixes** needed beyond what `forceRTL` mirrors automatically:
  - [PrayerTable.tsx:172](../../../src/components/PrayerTable.tsx) — the
    current-row accent uses `borderLeftWidth`; becomes `borderStartWidth`.
  - [TextField.tsx:34,42](../../../src/components/TextField.tsx) —
    `marginLeft` becomes `marginStart`.
  - The room-code displays (Settings, onboarding join field) keep
    `writingDirection: 'ltr'` explicitly so the 6 digits never reverse.
  - Manual check of the horizontal prayer-chip scroller in
    [WindowBanner.tsx](../../../src/components/WindowBanner.tsx) under RTL.
- **App name**: stays "Yalla Salah" under the home-screen icon (a native
  resource change, out of scope); the in-app header reads "يلا صلاة" in
  Arabic mode.

## Testing

New pure-logic tests, `ts-jest` as today:

- `hijri.test.ts` — the generated table checked against Node's own
  `Intl` calendar across its full range, plus fixed dates (1 Ramadan 1447 =
  18 Feb 2026; today = 1 Rabi' al-Thani 1448).
- `prayers.test.ts` — Jum'ah swap on Fridays only, every other day unchanged.
- `stats.test.ts` — weekly/monthly totals, Jum'ah counted apart from Dhuhr.
- `digits.test.ts` — Western → Arabic-Indic mapping.
- `direction.test.ts` — the switch/startup decision logic (no React Native
  imports, so it's a pure function of current vs. desired state).
- A translation-completeness test: every key in `en` has a matching key in
  `ar` and vice versa (belt-and-braces alongside the compile-time check).

Manual, two devices: switch each phone to the other language and confirm
mirroring; tick a mark 3 days back and confirm it saves; confirm a mark 9
days back is refused.

## Rollout

1. `npm run deploy:rules` (new day-edit-window rule).
2. Version bump to 1.2.0 (`package.json`, `app.json` versionCode).
3. `eas build -p android --profile preview` for the APK.
4. README: note the language setting's first-launch behavior and the new
   rules deploy step.

## Known trade-offs

- The edit-window rule compares against the rules engine's server-time date,
  not each device's local date, so it is intentionally ~1 day more generous
  each side than exactly 7 days. Acceptable under this app's existing
  "trust the two people who know the code" model.
- The Hijri table is exact for 1440–1500 AH (~2018–2077); outside that range
  it silently falls back to the less precise tabular arithmetic method.
- Switching language triggers one app reload (`Updates.reloadAsync()` /
  `DevSettings.reload()`) — unavoidable, since Android RTL is a native flag
  read at app start.
