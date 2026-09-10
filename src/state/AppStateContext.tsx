import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { STORAGE_KEYS } from '../config/constants';
import { DEFAULT_CITY_ID } from '../services/cities';
import { AppConfig } from '../types';

export const DEFAULT_CONFIG: AppConfig = {
  displayName: '',
  roomId: null,
  locationMode: 'gps',
  cityId: DEFAULT_CITY_ID,
  method: 'Egyptian',
  madhab: 'shafi',
  coords: null,
  dismissedLocationHint: false,
};

type AppStateValue = {
  config: AppConfig;
  ready: boolean;
  update: (patch: Partial<AppConfig>) => void;
  reset: () => void;
};

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

function persist(config: AppConfig): void {
  AsyncStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config)).catch(() => {
    // Storage is best-effort; an in-memory config still works for this session.
  });
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEYS.config);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as Partial<AppConfig>;
          setConfig({ ...DEFAULT_CONFIG, ...parsed });
        }
      } catch {
        // fall back to defaults
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<AppConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
    AsyncStorage.removeItem(STORAGE_KEYS.config).catch(() => {});
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({ config, ready, update, reset }),
    [config, ready, update, reset],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within an <AppStateProvider>');
  }
  return ctx;
}
