import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatCountdown, formatTime } from '../lib/dates';
import { PRAYERS, PrayerKey } from '../types';
import { useTheme } from '../theme/colors';

type Props = {
  times: Record<PrayerKey, Date>;
  currentKey: PrayerKey | null;
  next: { key: PrayerKey; at: Date } | null;
  now: number;
};

export function WindowBanner({ times, currentKey, next, now }: Props) {
  const t = useTheme();

  const currentName = currentKey
    ? PRAYERS.find((p) => p.key === currentKey)?.en ?? '—'
    : null;
  const nextName = next ? PRAYERS.find((p) => p.key === next.key)?.en ?? '—' : null;
  const remaining = next ? Math.max(0, next.at.getTime() - now) : 0;

  return (
    <View style={[styles.card, { backgroundColor: t.primary }]}>
      <View style={styles.topRow}>
        <View style={styles.headline}>
          <Text style={[styles.kicker, { color: withWhite(0.75) }]}>
            {currentKey ? 'CURRENT WINDOW' : 'UP NEXT'}
          </Text>
          <Text style={[styles.big, { color: t.onPrimary }]}>
            {currentName ?? nextName ?? '—'}
          </Text>
        </View>

        {next ? (
          <View style={styles.countdown}>
            <Text style={[styles.cdLabel, { color: withWhite(0.8) }]}>{nextName} in</Text>
            <Text style={[styles.cdValue, { color: t.onPrimary }]}>
              {formatCountdown(remaining)}
            </Text>
          </View>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {PRAYERS.map((p) => {
          const active = currentKey === p.key;
          const isNext = next?.key === p.key;
          return (
            <View
              key={p.key}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? t.onPrimary : withWhite(0.14),
                  borderColor: isNext ? t.accent : 'transparent',
                },
              ]}
            >
              <Text style={[styles.chipName, { color: active ? t.primary : t.onPrimary }]}>
                {p.short}
              </Text>
              <Text
                style={[styles.chipTime, { color: active ? t.primary : withWhite(0.85) }]}
              >
                {formatTime(times[p.key])}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function withWhite(alpha: number): string {
  return `rgba(255, 255, 255, ${alpha})`;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, gap: 14 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headline: { flexShrink: 1 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  big: { fontSize: 26, fontWeight: '900', marginTop: 2 },
  countdown: { alignItems: 'flex-end' },
  cdLabel: { fontSize: 11, fontWeight: '700' },
  cdValue: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 1 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    minWidth: 66,
  },
  chipName: { fontSize: 12, fontWeight: '800' },
  chipTime: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});
