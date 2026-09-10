import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme/colors';

/** Segmented progress indicator: `done` of `total` segments filled. */
export function ProgressBar({ total, done }: { total: number; done: number }) {
  const t = useTheme();

  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            {
              backgroundColor: i < done ? t.primary : t.surface,
              borderColor: t.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
