import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PRAYERS, PrayerKey, Marks } from '../types';
import { useTheme } from '../theme/colors';
import { Badge } from './Badge';
import { PrayerRow } from './PrayerRow';
import { ProgressBar } from './ProgressBar';

type Props = {
  title: string;
  subtitle?: string;
  marks: Marks;
  times?: Record<PrayerKey, Date>;
  currentKey: PrayerKey | null;
  editable: boolean;
  onToggle?: (prayer: PrayerKey) => void;
  waiting?: boolean;
};

export function UserColumn({
  title,
  subtitle,
  marks,
  times,
  currentKey,
  editable,
  onToggle,
  waiting = false,
}: Props) {
  const t = useTheme();
  const doneCount = PRAYERS.filter((p) => marks?.[p.key] != null).length;
  const complete = doneCount === PRAYERS.length;

  return (
    <View style={[styles.card, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.sub, { color: t.textDim }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Badge label={`${doneCount}/${PRAYERS.length}`} tone={complete ? 'done' : 'neutral'} />
      </View>

      <ProgressBar total={PRAYERS.length} done={doneCount} />

      <View style={styles.rows}>
        {PRAYERS.map((p) => (
          <PrayerRow
            key={p.key}
            labelEn={p.en}
            labelAr={p.ar}
            scheduledAt={times?.[p.key]}
            doneAt={marks?.[p.key] ?? null}
            isCurrent={currentKey === p.key}
            editable={editable && !waiting}
            onToggle={() => onToggle?.(p.key)}
          />
        ))}
      </View>

      {waiting ? (
        <Text style={[styles.waiting, { color: t.textDim }]}>Waiting for them to join…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headText: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  rows: { gap: 8 },
  waiting: { fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
});
