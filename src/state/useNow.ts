import { useEffect, useState } from 'react';

/**
 * `Date.now()` that re-renders the component on a fixed interval.
 * Used for live countdowns; default cadence is one second.
 */
export function useNow(intervalMs: number = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
