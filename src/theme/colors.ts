import { useColorScheme } from 'react-native';

export type Theme = {
  mode: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textDim: string;
  primary: string;
  primaryDim: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  success: string;
  danger: string;
  overlay: string;
};

const light: Theme = {
  mode: 'light',
  bg: '#F4F1E8',
  surface: '#FFFFFF',
  surfaceAlt: '#ECE7D8',
  border: '#DED7C2',
  text: '#1E2420',
  textDim: '#6C7269',
  primary: '#0E7C61',
  primaryDim: '#4EA98F',
  onPrimary: '#FFFFFF',
  accent: '#C6A24A',
  onAccent: '#22271F',
  success: '#0E7C61',
  danger: '#B3261E',
  overlay: 'rgba(20, 24, 22, 0.45)',
};

const dark: Theme = {
  mode: 'dark',
  bg: '#0F1412',
  surface: '#171E1B',
  surfaceAlt: '#1F2925',
  border: '#2C3733',
  text: '#ECEFEC',
  textDim: '#98A29C',
  primary: '#2FB894',
  primaryDim: '#1C7360',
  onPrimary: '#06110D',
  accent: '#D8B65E',
  onAccent: '#221B08',
  success: '#2FB894',
  danger: '#E5675E',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

export const palette = { light, dark };

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? dark : light;
}

/** Convert a `#rrggbb` hex string plus alpha (0..1) to an `rgba()` string. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
