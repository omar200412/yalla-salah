import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import { computeMetrics, type Metrics } from './layout';

/**
 * Live layout metrics for the current device. Re-renders on rotation, on
 * split-screen resize, and when the user changes their system font size.
 */
export function useMetrics(): Metrics {
  const { width, fontScale } = useWindowDimensions();
  return useMemo(() => computeMetrics(width, fontScale), [width, fontScale]);
}
