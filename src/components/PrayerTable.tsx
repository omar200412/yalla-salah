import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatTime, formatTimeShort } from '../lib/dates';
import { Metrics } from '../lib/layout';
import { useTheme, withAlpha, type Theme } from '../theme/colors';
import { Marks, PRAYERS, PrayerInfo, PrayerKey } from '../types';

type Props = {
  metrics: Metrics;
  myName: string;
  partnerName: string | null;
  myMarks: Marks;
  partnerMarks: Marks;
  times: Record<PrayerKey, Date>;
  currentKey: PrayerKey | null;
  onToggle: (prayer: PrayerKey) => void;
};

/**
 * The dashboard's single source of truth: one card, five prayer rows, and two
 * check columns - yours (tappable) and your partner's (read-only).
 *
 * A single table rather than two side-by-side cards is what makes this fit on a
 * 360dp phone: the prayer name gets the full row width minus two narrow slots,
 * instead of being squeezed into half a screen alongside its own timestamp.
 */
export function PrayerTable({
  metrics: m,
  myName,
  partnerName,
  myMarks,
  partnerMarks,
  times,
  currentKey,
  onToggle,
}: Props) {
  const t = useTheme();

  const myDone = PRAYERS.filter((p) => myMarks[p.key] != null).length;
  const theirDone = PRAYERS.filter((p) => partnerMarks[p.key] != null).length;
  const hasPartner = partnerName != null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: t.surfaceAlt,
          borderColor: t.border,
          padding: m.cardPadding,
          gap: m.rowGap,
        },
      ]}
    >
      <View style={[styles.header, { paddingHorizontal: m.rowPaddingH, gap: m.columnGap }]}>
        <Text style={[styles.headerLabel, { color: t.textDim }]} numberOfLines={1}>
          PRAYER
        </Text>

        <ColumnHeading
          t={t}
          width={m.slotWidth}
          name={myName}
          count={`${myDone}/${PRAYERS.length}`}
          complete={myDone === PRAYERS.length}
        />
        <ColumnHeading
          t={t}
          width={m.slotWidth}
          name={partnerName ?? '—'}
          count={hasPartner ? `${theirDone}/${PRAYERS.length}` : ''}
          complete={hasPartner && theirDone === PRAYERS.length}
          muted={!hasPartner}
        />
      </View>

      {PRAYERS.map((prayer) => (
        <PrayerTableRow
          key={prayer.key}
          t={t}
          m={m}
          prayer={prayer}
          scheduledAt={times[prayer.key]}
          isCurrent={currentKey === prayer.key}
          mineAt={myMarks[prayer.key] ?? null}
          theirsAt={partnerMarks[prayer.key] ?? null}
          hasPartner={hasPartner}
          myName={myName}
          partnerName={partnerName}
          onToggle={() => onToggle(prayer.key)}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */

function ColumnHeading({
  t,
  width,
  name,
  count,
  complete,
  muted = false,
}: {
  t: Theme;
  width: number;
  name: string;
  count: string;
  complete: boolean;
  muted?: boolean;
}) {
  return (
    <View style={[styles.slot, { width }]}>
      {/* A short label, not content: let it shrink to fit rather than
          truncate to "O..." when the system font scale is turned up. */}
      <Text
        style={[styles.headerName, { color: muted ? t.textDim : t.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {name}
      </Text>
      {count ? (
        <Text style={[styles.headerCount, { color: complete ? t.primary : t.textDim }]}>
          {count}
        </Text>
      ) : null}
    </View>
  );
}

function PrayerTableRow({
  t,
  m,
  prayer,
  scheduledAt,
  isCurrent,
  mineAt,
  theirsAt,
  hasPartner,
  myName,
  partnerName,
  onToggle,
}: {
  t: Theme;
  m: Metrics;
  prayer: PrayerInfo;
  scheduledAt: Date;
  isCurrent: boolean;
  mineAt: number | null;
  theirsAt: number | null;
  hasPartner: boolean;
  myName: string;
  partnerName: string | null;
  onToggle: () => void;
}) {
  const mine = mineAt != null;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: mine
            ? withAlpha(t.primary, t.mode === 'dark' ? 0.14 : 0.08)
            : t.surface,
          borderColor: isCurrent ? t.accent : t.border,
          borderLeftWidth: isCurrent ? 3 : StyleSheet.hairlineWidth,
          paddingHorizontal: m.rowPaddingH,
          paddingVertical: m.rowPaddingV,
          gap: m.columnGap,
        },
      ]}
    >
      <View style={styles.nameCell}>
        <Text style={[styles.nameEn, { color: t.text }]} numberOfLines={2}>
          {prayer.en}
          {m.showArabic ? (
            <Text style={[styles.nameAr, { color: t.textDim }]}>{`  ${prayer.ar}`}</Text>
          ) : null}
        </Text>
        <Text style={[styles.meta, { color: t.textDim }]} numberOfLines={1}>
          {formatTime(scheduledAt)}
          {isCurrent ? (
            <Text style={[styles.now, { color: t.accent }]}>{'   ·   NOW'}</Text>
          ) : null}
        </Text>
      </View>

      <CheckSlot
        t={t}
        m={m}
        checked={mine}
        at={mineAt}
        editable
        onPress={onToggle}
        label={`${prayer.en}, ${myName}`}
      />
      <CheckSlot
        t={t}
        m={m}
        checked={theirsAt != null}
        at={theirsAt}
        editable={false}
        muted={!hasPartner}
        label={
          hasPartner
            ? `${prayer.en}, ${partnerName}`
            : `${prayer.en}, nobody has joined yet`
        }
      />
    </View>
  );
}

function CheckSlot({
  t,
  m,
  checked,
  at,
  editable,
  onPress,
  muted = false,
  label,
}: {
  t: Theme;
  m: Metrics;
  checked: boolean;
  at: number | null;
  editable: boolean;
  onPress?: () => void;
  muted?: boolean;
  label: string;
}) {
  const box = (
    <View
      style={[
        styles.box,
        {
          width: m.boxSize,
          height: m.boxSize,
          borderColor: checked ? t.primary : t.border,
          backgroundColor: checked ? t.primary : 'transparent',
          // A dashed ring marks the column you cannot tap.
          borderStyle: editable ? 'solid' : 'dashed',
          opacity: muted ? 0.35 : 1,
        },
      ]}
    >
      {checked ? (
        <Text style={[styles.check, { color: t.onPrimary, fontSize: m.checkFontSize }]}>✓</Text>
      ) : null}
    </View>
  );

  const stamp =
    m.showStamp && checked && at != null ? (
      <Text style={[styles.stamp, { color: t.primary }]} numberOfLines={1}>
        {formatTimeShort(new Date(at))}
      </Text>
    ) : null;

  if (!editable) {
    return (
      <View
        style={[styles.slot, { width: m.slotWidth }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${label}: ${checked ? 'completed' : 'not completed'}`}
      >
        {box}
        {stamp}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.slot,
        { width: m.slotWidth, opacity: pressed ? 0.55 : 1 },
      ]}
    >
      {box}
      {stamp}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 2,
  },
  headerLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  headerName: { fontSize: 13, fontWeight: '800' },
  headerCount: { fontSize: 11, fontWeight: '700', marginTop: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    // minHeight, never height: the row must be free to grow when the system
    // font scale pushes the name onto a second line.
    minHeight: 52,
  },
  nameCell: { flex: 1, minWidth: 0 },
  nameEn: { fontSize: 15, fontWeight: '700' },
  nameAr: { fontSize: 13, fontWeight: '600' },
  meta: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  now: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  slot: { alignItems: 'center', justifyContent: 'center' },
  box: {
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { fontWeight: '900' },
  stamp: { fontSize: 9, fontWeight: '800', marginTop: 3 },
});
