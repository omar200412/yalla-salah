import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime } from '../lib/dates';
import { useTheme, withAlpha } from '../theme/colors';

type Props = {
  labelEn: string;
  labelAr: string;
  scheduledAt?: Date;
  doneAt: number | null;
  isCurrent: boolean;
  editable: boolean;
  onToggle?: () => void;
};

export function PrayerRow({
  labelEn,
  labelAr,
  scheduledAt,
  doneAt,
  isCurrent,
  editable,
  onToggle,
}: Props) {
  const t = useTheme();
  const done = doneAt != null;

  const body = (
    <>
      <View
        style={[
          styles.check,
          {
            borderColor: done ? t.primary : t.border,
            backgroundColor: done ? t.primary : 'transparent',
          },
        ]}
      >
        {done ? <Text style={[styles.checkMark, { color: t.onPrimary }]}>✓</Text> : null}
      </View>

      <View style={styles.middle}>
        <Text style={[styles.en, { color: t.text }]}>{labelEn}</Text>
        <Text style={[styles.ar, { color: t.textDim }]}>{labelAr}</Text>
      </View>

      <View style={styles.right}>
        {scheduledAt ? (
          <Text style={[styles.time, { color: t.textDim }]}>{formatTime(scheduledAt)}</Text>
        ) : null}
        {done && doneAt ? (
          <Text style={[styles.doneAt, { color: t.primary }]}>✓ {formatTime(new Date(doneAt))}</Text>
        ) : isCurrent ? (
          <Text style={[styles.now, { color: t.accent }]}>NOW</Text>
        ) : null}
      </View>
    </>
  );

  const containerStyle = {
    backgroundColor: done ? withAlpha(t.primary, t.mode === 'dark' ? 0.18 : 0.1) : t.surface,
    borderColor: isCurrent ? t.accent : t.border,
    borderLeftWidth: isCurrent ? 3 : StyleSheet.hairlineWidth,
  };

  if (!editable) {
    return <View style={[styles.row, containerStyle]}>{body}</View>;
  }

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={`${labelEn}${done ? ', completed' : ', not completed'}`}
      onPress={onToggle}
      style={({ pressed }) => [styles.row, containerStyle, { opacity: pressed ? 0.7 : 1 }]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 15, fontWeight: '900', lineHeight: 18 },
  middle: { flex: 1 },
  en: { fontSize: 15, fontWeight: '700' },
  ar: { fontSize: 13, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 2 },
  time: { fontSize: 12, fontWeight: '600' },
  doneAt: { fontSize: 11, fontWeight: '800' },
  now: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
});
