# Yalla Salah 🕌

A tiny two-person Android app for a father and son (or any two people) to track
each other's five daily prayers **in real time**. Each person installs their own
copy, pairs with a 6-digit code, and sees the other's checklist update live.

- **Frontend:** Expo SDK 54 + React Native 0.81 + TypeScript
- **Backend:** Firebase — Anonymous Auth + Cloud Firestore (free tier, no server)
- **Prayer times:** `adhan` v4, GPS or a bundled city list
- **Reset:** automatically at local midnight

---

## 0. Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20 or newer | `node -v` |
| npm | 10 or newer | ships with Node |
| Expo account | free | <https://expo.dev/signup> — only needed for cloud (EAS) builds |
| A phone | Android 7+ | or an emulator |
| Java JDK | 17 | **only** for the fully-offline `gradlew` build |
| Android SDK | – | **only** for the fully-offline `gradlew` build (Android Studio installs it) |

```bash
npm install -g eas-cli
```

---

## 1. Create the Firebase project (5 minutes, one time)

1. Go to <https://console.firebase.google.com> → **Add project**. Name it
   `yalla-salah`. Disable Google Analytics (not needed).
2. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable → Save.**
3. **Build → Firestore Database → Create database → Start in production mode.**
   Pick the region closest to you (e.g. `eur3` / `europe-west`). Create.
4. **Project settings** (gear icon) **→ General → Your apps → `</>` (Web).**
   Register app nickname `yalla-salah`. Firebase shows a `firebaseConfig`
   object — keep this tab open, you need those 6 values next.

> These values are **client identifiers, not secrets** — they ship inside every
> mobile app. Your data is protected by the Firestore rules in
> [`firestore.rules`](firestore.rules), not by hiding them.

---

## 2. Configure the app

```bash
git clone <your-repo-url> yalla-salah   # or use this folder directly
cd yalla-salah
npm install
npm run assets            # generates assets/*.png (crescent icon + splash)
cp .env.example .env      # Windows PowerShell:  Copy-Item .env.example .env
```

Open `.env` and paste your Firebase web config:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy............................
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=yalla-salah.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=yalla-salah
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=yalla-salah.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef1234567890
```

---

## 3. Deploy the Firestore security rules

```bash
npm install -g firebase-tools
firebase login
```

Edit [`.firebaserc`](.firebaserc) and replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`
with your real project id (e.g. `yalla-salah`). Then:

```bash
npm run deploy:rules
```

This pushes [`firestore.rules`](firestore.rules) and
[`firestore.indexes.json`](firestore.indexes.json) (no composite indexes are
needed). You can also paste the rules file contents directly into
**Firestore → Rules** in the console and click **Publish**.

---

## 4. Run it in development

```bash
npx expo start
```

Press `a` for an Android emulator, or scan the QR code with **Expo Go** on your
phone. First launch → enter a name → **Create a room** → note the 6-digit code.
On the second device, enter a name → **I have a code** → type the code → **Join**.
Tap prayers on the "You" column; watch them appear on the other phone.

Run the logic tests / type check any time:

```bash
npm test
npm run typecheck
```

---

## 5. Build the installable APK

### Option A — EAS Build (recommended, no Android SDK needed)

```bash
eas login
eas init                      # links this project to your Expo account, writes the projectId
```

Put your Firebase values where the cloud build can see them. Easiest: open
[`eas.json`](eas.json) and replace every `REPLACE_ME` under
`build.preview.env` with the same values from your `.env`.
(Alternatively, keep them out of git with
`eas env:create --environment preview --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..."`
for each of the six.)

Then build:

```bash
eas build -p android --profile preview
```

When it finishes (~10–15 min) the CLI prints a URL. Download the `.apk` from
there, or:

```bash
eas build:list --platform android --limit 1
# then download the artifact URL it shows
```

Copy the APK to each phone (email / USB / Google Drive) and install it. You may
need to allow "Install unknown apps" for the file manager the first time.

### Option B — Fully local build (`gradlew`, no Expo account)

Requires **JDK 17** and the **Android SDK** (install Android Studio, then set
`ANDROID_HOME` / `ANDROID_SDK_ROOT`).

```bash
# 1. Generate the native android/ project from app.json
npx expo prebuild --platform android --clean

# 2. Make the Firebase env vars available to the JS bundler during the build
#    (EXPO_PUBLIC_* vars are inlined at build time)
#    macOS/Linux:
export $(grep -v '^#' .env | xargs)
#    Windows PowerShell:
#    Get-Content .env | ? { $_ -and $_ -notmatch '^#' } | % { $kv = $_ -split '=',2; [Environment]::SetEnvironmentVariable($kv[0], $kv[1]) }

# 3. Build a release APK
cd android
./gradlew assembleRelease          # Windows:  .\gradlew.bat assembleRelease
```

The APK is written to:

```
android/app/build/outputs/apk/release/app-release.apk
```

> The release APK is signed with the auto-generated debug keystore, which is
> fine for sideloading onto your own phones. For the Play Store you would create
> a real upload keystore — out of scope here.

Install over USB:

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

To rebuild after changing JS only, re-run step 3. After changing `app.json`,
re-run `npx expo prebuild --clean` first.

---

## 6. GitHub

This project is already on GitHub (private):
<https://github.com/omar200412/yalla-salah> — `main` branch.

```bash
git add -A && git commit -m "..." && git push
```

`.env`, `/android`, `/ios` and `*.apk` are git-ignored. `eas.json` is **not**
ignored — it currently holds `REPLACE_ME` placeholders. If you paste real
Firebase values there, keep the repo **private** (it is) or switch to
`eas env:create` instead (see step 5A) before making it public.

---

## Project layout

```
yalla-salah/
├── App.tsx                     root: auth + config gate → Onboarding / Dashboard
├── index.ts                    registerRootComponent entry
├── app.json                    Expo config (icon, splash, android package, permissions)
├── eas.json                    EAS build profiles (preview = APK)
├── metro.config.js             Firebase-on-RN resolver tweaks (required)
├── firebase.json / .firebaserc / firestore.rules / firestore.indexes.json
├── scripts/
│   └── generate-assets.js      dependency-free PNG icon/splash generator
├── src/
│   ├── config/
│   │   ├── constants.ts        storage keys, calculation-method list
│   │   └── firebase.ts         Firebase app / anonymous auth / Firestore init
│   ├── theme/
│   │   └── colors.ts           light + dark palettes, useTheme(), withAlpha()
│   ├── types/index.ts          shared domain types (PrayerKey, AppConfig, RoomDoc…)
│   ├── lib/
│   │   ├── dates.ts            todayKey, formatTime, formatCountdown, humanDate
│   │   ├── layout.ts           pure responsive size tokens (unit-tested)
│   │   ├── useMetrics.ts       binds layout.ts to live device width + fontScale
│   │   ├── code.ts             6-digit code generate / validate / normalize
│   │   └── haptics.ts
│   ├── services/
│   │   ├── cities.ts           bundled fallback city list
│   │   ├── location.ts         expo-location wrapper
│   │   └── prayerTimes.ts      adhan wrapper → times, current window, next prayer
│   ├── state/
│   │   ├── AppStateContext.tsx  local config, persisted to AsyncStorage
│   │   ├── useAuth.ts           anonymous sign-in
│   │   ├── useToday.ts          local date, updates across midnight
│   │   ├── useNow.ts            1-second tick for countdowns
│   │   └── useRoomSync.ts       Firestore listeners + createRoom / joinRoom / toggle / rename / leave
│   ├── components/
│   │   ├── Button.tsx  TextField.tsx
│   │   ├── PrayerTable.tsx      the whole checklist: 5 rows x 2 check columns
│   │   └── WindowBanner.tsx     current window + countdown + 5 time chips
│   └── screens/
│       ├── OnboardingScreen.tsx name + create/join room
│       ├── DashboardScreen.tsx  the live dashboard
│       └── SettingsModal.tsx    name, code, location, method, madhab, leave
├── __tests__/                  dates / code / prayerTimes / layout unit tests
└── docs/superpowers/specs/     design document
```

---

## Responsive behaviour

The dashboard is one table — five prayer rows, two check columns (yours is
tappable and solid, your partner's is read-only and dashed). That single-table
shape is what lets the prayer name keep a readable column on a 360dp phone;
two side-by-side per-person cards left it only ~74dp and the name overlapped
its own timestamp.

[`src/lib/layout.ts`](src/lib/layout.ts) is a pure function of
`(width, fontScale)` — no React, no React Native — so the sizing rules are
unit-tested directly in [`__tests__/layout.test.ts`](__tests__/layout.test.ts).
[`useMetrics.ts`](src/lib/useMetrics.ts) feeds it live values from
`useWindowDimensions()`, so the layout reacts to rotation, split-screen resize,
and the system font-size setting.

| Condition | What changes |
| --- | --- |
| width < 340dp | Tighter padding, smaller checkboxes and slots, stacked banner, stacked invite buttons |
| width ≥ 600dp | Extra breathing room (tablet / landscape) |
| Name column too narrow for `English + العربية` | Arabic name is dropped rather than allowed to collide |
| fontScale ≥ ~1.35 | Per-check timestamps are dropped |
| Any fontScale | Checkbox and slot sizes grow with it (capped), rows use `minHeight` so text may wrap to two lines |

React Native already multiplies every `fontSize` by the system font scale, so
the code deliberately never shrinks type to compensate — that would defeat the
accessibility setting. It grows the fixed-size boxes alongside the text and
drops optional detail instead.

---

## How pairing & sync works

1. On first launch the device signs in **anonymously** — a stable, persisted
   `uid`, no email or password.
2. **Create a room** writes `rooms/{code}` with a random unused 6-digit id and
   `slots.a = uid`. **Join** claims `slots.b` in a transaction.
3. The dashboard subscribes to `rooms/{code}` and
   `rooms/{code}/days/{today}`.
4. Checking a prayer writes only `marks.{uid}.{prayer}` with `{ merge: true }` —
   the other person's data is never touched. The other device's listener fires
   within a second.
5. At local midnight `useToday()` produces a new date string, the day listener
   re-subscribes to the fresh (empty) document, and both checklists reset.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Missing EXPO_PUBLIC_FIREBASE_* environment variables` | Create `.env` (step 2) and restart `expo start` with cache clear: `npx expo start -c`. |
| `Component auth has not been registered yet` | `metro.config.js` must contain the two Firebase tweaks (it does in this repo). Restart with `npx expo start -c`. |
| Firestore reads/writes hang forever | Ensure `experimentalForceLongPolling: true` in `src/config/firebase.ts` (it is), and that you're online. |
| `Missing or insufficient permissions` | Deploy the rules (step 3) and confirm **Anonymous** auth is enabled. |
| Prayer times look wrong | Settings → pick your city or "Detect my location", and choose the calculation method used in your country. |
| Versions mismatch after `npm install` | `npx expo install --fix` snaps every Expo package to the SDK 54 version. |
| EAS build fails on missing env | Fill `eas.json` → `build.preview.env`, or use `eas env:create` (step 5A). |
| EAS build fails in *Install dependencies* with `Missing: @react-native-async-storage/async-storage@1.24.0 from lock file` | `@firebase/auth` declares an optional peer dep on async-storage `^1.18.1` while Expo SDK 54 needs `2.2.0`. Newer npm tolerates it, EAS's older npm does not. Fixed by [`.npmrc`](.npmrc) (`legacy-peer-deps=true`); if you ever regenerate the lockfile, keep that file and run `npm install` (not `npm install --force`). |
| Reinstalled the app and can't rejoin ("room already has two people") | Anonymous sign-in creates a fresh identity on reinstall, so your old slot is orphaned. Fix: on **either** phone, create a brand-new room (Onboarding → Create) and share the new code; the other person taps **Settings → Leave room**, then joins the new code. |
