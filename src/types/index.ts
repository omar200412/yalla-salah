// Shared domain types for Yalla Salah.

export const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];

export type PrayerInfo = {
  key: PrayerKey;
  en: string;
  ar: string;
  short: string;
};

export const PRAYERS: PrayerInfo[] = [
  { key: 'fajr', en: 'Fajr', ar: 'الفجر', short: 'Fajr' },
  { key: 'dhuhr', en: 'Dhuhr', ar: 'الظهر', short: 'Dhuhr' },
  { key: 'asr', en: 'Asr', ar: 'العصر', short: 'Asr' },
  { key: 'maghrib', en: 'Maghrib', ar: 'المغرب', short: 'Maghrib' },
  { key: 'isha', en: 'Isha', ar: 'العشاء', short: 'Isha' },
];

// Keys of `adhan`'s CalculationMethod factory functions that we expose in the UI.
export type MethodKey =
  | 'Egyptian'
  | 'MuslimWorldLeague'
  | 'UmmAlQura'
  | 'Karachi'
  | 'Dubai'
  | 'Qatar'
  | 'Kuwait'
  | 'Turkey'
  | 'Tehran'
  | 'NorthAmerica'
  | 'Singapore'
  | 'MoonsightingCommittee';

export type Madhab = 'shafi' | 'hanafi';

export type LocationMode = 'gps' | 'manual';

export type Coords = { lat: number; lng: number };

/**
 * Locally-persisted, device-specific configuration.
 * The shared prayer state lives in Firestore (see `useRoomSync`).
 */
export type AppConfig = {
  displayName: string;
  roomId: string | null;
  locationMode: LocationMode;
  cityId: string;
  method: MethodKey;
  madhab: Madhab;
  coords: Coords | null;
  dismissedLocationHint: boolean;
};

export type City = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  method: MethodKey;
};

// Per-prayer completion marker: epoch-ms when the prayer was checked off, or null.
export type Marks = Partial<Record<PrayerKey, number | null>>;

export type RoomDoc = {
  createdAt?: unknown;
  slots: { a: string | null; b: string | null };
  names: Record<string, string>;
};

export type DayDoc = {
  updatedAt?: unknown;
  marks: Record<string, Marks>;
};
