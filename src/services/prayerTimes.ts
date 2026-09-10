import {
  CalculationMethod,
  CalculationParameters,
  Coordinates,
  Madhab as AdhanMadhab,
  PrayerTimes,
} from 'adhan';

import { Madhab, MethodKey, PRAYER_KEYS, PrayerKey } from '../types';

type MethodFactory = () => CalculationParameters;

const METHOD_FACTORIES: Record<MethodKey, MethodFactory> = {
  Egyptian: () => CalculationMethod.Egyptian(),
  MuslimWorldLeague: () => CalculationMethod.MuslimWorldLeague(),
  UmmAlQura: () => CalculationMethod.UmmAlQura(),
  Karachi: () => CalculationMethod.Karachi(),
  Dubai: () => CalculationMethod.Dubai(),
  Qatar: () => CalculationMethod.Qatar(),
  Kuwait: () => CalculationMethod.Kuwait(),
  Turkey: () => CalculationMethod.Turkey(),
  Tehran: () => CalculationMethod.Tehran(),
  NorthAmerica: () => CalculationMethod.NorthAmerica(),
  Singapore: () => CalculationMethod.Singapore(),
  MoonsightingCommittee: () => CalculationMethod.MoonsightingCommittee(),
};

export type ComputedTimes = {
  /** The five daily prayer times for the given date + location. */
  times: Record<PrayerKey, Date>;
  sunrise: Date;
  /**
   * The prayer whose window is currently active, or `null` if it is before
   * today's Fajr and Isha from the previous night has already lapsed by our
   * simple model. Between local midnight and Fajr this is reported as `isha`.
   */
  currentKey: PrayerKey | null;
  /** The next upcoming prayer (rolls over to tomorrow's Fajr after Isha). */
  next: { key: PrayerKey; at: Date } | null;
};

export type ComputeOptions = {
  lat: number;
  lng: number;
  methodKey: MethodKey;
  madhab: Madhab;
  date?: Date;
};

export function computeTimes(opts: ComputeOptions): ComputedTimes {
  const { lat, lng, methodKey, madhab, date = new Date() } = opts;

  const coordinates = new Coordinates(lat, lng);
  const params = (METHOD_FACTORIES[methodKey] ?? METHOD_FACTORIES.MuslimWorldLeague)();
  params.madhab = madhab === 'hanafi' ? AdhanMadhab.Hanafi : AdhanMadhab.Shafi;

  const pt = new PrayerTimes(coordinates, date, params);
  const times: Record<PrayerKey, Date> = {
    fajr: pt.fajr,
    dhuhr: pt.dhuhr,
    asr: pt.asr,
    maghrib: pt.maghrib,
    isha: pt.isha,
  };

  const nowMs = date.getTime();

  // Current window: the latest prayer whose time has already passed today.
  let currentKey: PrayerKey | null = null;
  for (const key of PRAYER_KEYS) {
    if (times[key].getTime() <= nowMs) {
      currentKey = key;
    }
  }
  // Before Fajr, the Isha window from the previous night is still in effect.
  if (currentKey === null && nowMs < times.fajr.getTime()) {
    currentKey = 'isha';
  }

  // Next prayer: the first prayer strictly in the future today...
  let next: { key: PrayerKey; at: Date } | null = null;
  for (const key of PRAYER_KEYS) {
    if (times[key].getTime() > nowMs) {
      next = { key, at: times[key] };
      break;
    }
  }
  // ...otherwise it is tomorrow's Fajr.
  if (!next) {
    const tomorrow = new Date(date);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const ptTomorrow = new PrayerTimes(coordinates, tomorrow, params);
    next = { key: 'fajr', at: ptTomorrow.fajr };
  }

  return { times, sunrise: pt.sunrise, currentKey, next };
}
