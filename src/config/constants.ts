import { MethodKey } from '../types';

export const APP_NAME = 'Yalla Salah';
export const APP_VERSION = '1.1.0';

export const STORAGE_KEYS = {
  config: '@yalla-salah/config:v1',
} as const;

export const NAME_MAX_LENGTH = 24;
export const ROOM_CODE_LENGTH = 6;

// Human-readable labels for each `adhan` calculation method we support.
export const METHODS: { key: MethodKey; label: string; note: string }[] = [
  { key: 'Egyptian', label: 'Egyptian General Authority', note: 'Egypt, Syria, Iraq, Lebanon, Malaysia' },
  { key: 'MuslimWorldLeague', label: 'Muslim World League', note: 'Europe, Far East, parts of US' },
  { key: 'UmmAlQura', label: 'Umm al-Qura, Makkah', note: 'Saudi Arabia' },
  { key: 'Karachi', label: 'University of Islamic Sciences, Karachi', note: 'Pakistan, Bangladesh, India, Afghanistan' },
  { key: 'Dubai', label: 'Dubai', note: 'United Arab Emirates' },
  { key: 'Qatar', label: 'Qatar', note: 'Qatar' },
  { key: 'Kuwait', label: 'Kuwait', note: 'Kuwait' },
  { key: 'Turkey', label: 'Diyanet İşleri, Turkey', note: 'Turkey' },
  { key: 'Tehran', label: 'Institute of Geophysics, Tehran', note: 'Iran, some Shia communities' },
  { key: 'NorthAmerica', label: 'ISNA, North America', note: 'Canada, USA' },
  { key: 'Singapore', label: 'Majlis Ugama Islam Singapura', note: 'Singapore, Indonesia' },
  { key: 'MoonsightingCommittee', label: 'Moonsighting Committee', note: 'Global, higher-latitude aware' },
];
