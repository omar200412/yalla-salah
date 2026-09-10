import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { todayKey } from '../lib/dates';

/**
 * The current local calendar date as `YYYY-MM-DD`. Updates automatically when
 * the clock crosses midnight or when the app returns to the foreground — this is
 * what drives the "reset at midnight" behaviour.
 */
export function useToday(): string {
  const [key, setKey] = useState<string>(() => todayKey());

  useEffect(() => {
    const sync = () => {
      const next = todayKey();
      setKey((current) => (current === next ? current : next));
    };

    const interval = setInterval(sync, 30_000);
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') sync();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  return key;
}
