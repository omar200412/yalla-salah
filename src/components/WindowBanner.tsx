import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatCountdown, formatTime } from '../lib/dates';
import { Metrics } from '../lib/layout';
import { PRAYERS, PrayerKey } from '../types';
import { useTheme } from '../theme/colors';

type Props = {
  metrics: Metrics;
  times: Record<PrayerKey, Date>;
  currentKey: PrayerKey | null;
  next: { key: PrayerKey; at: Date } | null;
  now: number;
};

export function WindowBanner({ metrics: m, times, currentKey, next, now }: Props) {
  const t = useTheme();

  const currentName = currentKey
    ? PRAYERS.find((p) => p.key === currentKey)?.en ?? '—'
    : null;
  const nextName = next ? PRAYERS.find((p) => p.key === next.key)?.en ?? '—' : null;
  const remaining = next ? Math.max(0, next.at.getTime() - now) : 0;

  const countdown = next ? (
    <View style={m.stackBanner ? styles.countdownStacked : styles.countdownInline}>
      <Text style={[styles.cdLabel, { color: white(0.8) }]} numberOfLines={1}>
        {nextName} in
      </Text>
      <Text style={[styles.cdValue, { color: t.onPrimary }]} numberOfLines={1}>
        {formatCountdown(remaining)}
      </Text>
    </View>
  ) : null;

  return (
    <View style={[styles.card, { backgroundColor: t.primary, padding: m.tiny ? 13 : 16 }]}>
      {/* Side by side normally; stacked once the text is scaled up or the
          screen is narrow, where two columns would collide. */}
      <View style={m.stackBanner ? styles.topStacked : styles.topRow}>
        <View style={styles.headline}>
          <Text style={[styles.kicker, { color: white(0.75) }]} numberOfLines={1}>
            {currentKey ? 'CURRENT WINDOW' : 'UP NEXT'}
          </Text>
          <Text
            style={[styles.big, { color: t.onPrimary, fontSize: m.bannerTitleSize }]}
            numberOfLines={1}
          >
            {currentName ?? nextName ?? '—'}
          </Text>
        </View>
        {countdown}
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
                  backgroundColor: active ? t.onPrimary : white(0.14),
                  borderColor: isNext ? t.accent : 'transparent',
                  minWidth: m.tiny ? 58 : 66,
                },
              ]}
            >
              <Text
                style={[styles.chipName, { color: active ? t.primary : t.onPrimary }]}
                numberOfLines={1}
              >
                {p.short}
              </Text>
              <Text
                style={[styles.chipTime, { color: active ? t.primary : white(0.85) }]}
                numberOfLines={1}
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

function white(alpha: number): string {
  return `rgba(255, 255, 255, ${alpha})`;
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, gap: 14 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  topStacked: { gap: 8 },
  headline: { flexShrink: 1, minWidth: 0 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  big: { fontWeight: '900', marginTop: 2 },
  countdownInline: { alignItems: 'flex-end', flexShrink: 0 },
  countdownStacked: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexWrap: 'wrap',
  },
  cdLabel: { fontSize: 11, fontWeight: '700' },
  cdValue: { fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'], marginTop: 1 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  chipName: { fontSize: 12, fontWeight: '800' },
  chipTime: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});
