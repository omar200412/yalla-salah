# Yalla Salah — Design

**Date:** 2026-09-10
**Status:** Approved, implemented

## Purpose

A standalone Android app (installable APK) for **exactly two people** — in this
case a father and son — to track each other's five daily prayers (Fajr, Dhuhr,
Asr, Maghrib, Isha) in real time. Each person runs their own copy. When either
checks off a prayer, it appears instantly on the other's screen.

Not in scope: more than two users, push notifications, streak history,
authentication with email/phone, a web build.

## Decisions

| Question | Decision |
| --- | --- |
| Real-time backend | **Firebase** — Anonymous Auth + Firestore realtime listeners. No server code. |
| Framework | **Expo SDK 54** (managed) + TypeScript. `registerRootComponent`, no navigation library (2 screens + 1 modal). |
| Prayer calculation | `adhan` v4. GPS via `expo-location`, with a bundled city list as fallback. Method selectable (default: Egyptian). |
| Daily reset | **Local midnight** — day documents are keyed by `YYYY-MM-DD` in device-local time. |
| APK build | `eas build -p android --profile preview` (cloud APK); `expo prebuild` + `./gradlew assembleRelease` documented for offline. |
| Pairing | 6-digit numeric code == the Firestore room document id (the "shared room ID"). |

## Architecture

```
App.tsx ─ SafeAreaProvider ─ AppStateProvider
  └─ Gate                       reads local config + anonymous auth
       ├─ OnboardingScreen      no room yet: set name, create or join a room
       └─ DashboardScreen       paired: banner + two columns + settings modal
```

- **Local, per-device state** (`AppStateContext`, persisted to AsyncStorage):
  display name, roomId, location mode, city, calculation method, madhab, last
  GPS coords.
- **Shared state** (Firestore, via `useRoomSync`): the room (members + names)
  and today's marks.
- **Time** (`useToday`, `useNow`): `useToday` yields the local date string and
  updates across midnight / on resume; `useNow` ticks each second for the
  countdown.
- **Prayer maths** (`services/prayerTimes.ts`): pure function
  `computeTimes({lat,lng,methodKey,madhab,date})` → the five times, the active
  window, and the next prayer.

### Data model

```
rooms/{code}                         code: /^[0-9]{6}$/, IS the document id
  createdAt : serverTimestamp
  slots     : { a: <uid>|null, b: <uid>|null }
  names     : { <uid>: string }       // ≤ 40 chars

rooms/{code}/days/{YYYY-MM-DD}
  updatedAt : serverTimestamp
  marks     : { <uid>: { fajr|dhuhr|asr|maghrib|isha : <epoch-ms> | null } }
```

One snapshot listener on the room document, one on today's day document.
Toggling a prayer is a single `setDoc(dayRef, { marks: { <uid>: { <prayer>: ts|null } } }, { merge:true })`
— Firestore merges at field level, so the two members never overwrite each
other even when writing simultaneously.

### Security model

The 6-digit code is a shared secret. Anyone signed in (anonymously) who knows a
code can read that room and claim one of its two slots. Once both slots are
filled, no third party can write. Rules enforce:

- room `create`: shape-valid, `slots.a == uid`, `slots.b == null`, one name key.
- room `update`: caller is a current member changing only their own name; **or**
  caller is joining an empty slot without touching the other; **or** caller is
  vacating their own slot (leave).
- `days/*`: read/write only if a `get()` on the parent room shows the caller in
  a slot, and a write's `marks` diff touches only the caller's own uid key.
- everything else denied; no `list` anywhere.

## Testing

Pure logic is unit-tested with `jest-expo`:

- `dates.test.ts` — date key, 12-hour formatting, countdown formatting.
- `code.test.ts` — 6-digit generation / validation / normalisation.
- `prayerTimes.test.ts` — ordering, active-window selection, pre-Fajr carryover,
  next-prayer rollover, Hanafi Asr shift.

UI is verified manually on two devices (the two-user real-time flow is the
product).

## Known trade-offs

- No collusion protection beyond "knows the code" — acceptable for a private
  two-person app; codes are random 6-digit and checked for collision on create.
- `computeTimes` recomputes each minute on the client; prayer times are not
  stored server-side.
- Leaving a room frees the slot best-effort (rules allow it); if offline, the
  local unpair still happens and the stale slot can be reclaimed later.
