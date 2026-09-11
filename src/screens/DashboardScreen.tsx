import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { PrayerTable } from '../components/PrayerTable';
import { WindowBanner } from '../components/WindowBanner';
import { APP_NAME } from '../config/constants';
import { humanDate } from '../lib/dates';
import { tapFeedback } from '../lib/haptics';
import { type Metrics } from '../lib/layout';
import { useMetrics } from '../lib/useMetrics';
import { findCity } from '../services/cities';
import { detectCoords } from '../services/location';
import { computeTimes } from '../services/prayerTimes';
import { useAppState } from '../state/AppStateContext';
import { useNow } from '../state/useNow';
import { useRoomSync } from '../state/useRoomSync';
import { useToday } from '../state/useToday';
import { useTheme, type Theme } from '../theme/colors';
import { Coords, PrayerKey } from '../types';
import { SettingsModal } from './SettingsModal';

export function DashboardScreen({ uid }: { uid: string }) {
  const t = useTheme();
  const m = useMetrics();
  const { config, update } = useAppState();
  const today = useToday();
  const now = useNow(1000);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    room,
    loading,
    error,
    setError,
    partnerUid,
    myMarks,
    partnerMarks,
    toggle,
    rename,
    leave,
  } = useRoomSync(config.roomId, uid, today);

  const coords = useMemo<Coords>(() => {
    if (config.locationMode === 'gps' && config.coords) return config.coords;
    const city = findCity(config.cityId);
    return { lat: city.lat, lng: city.lng };
  }, [config.locationMode, config.coords, config.cityId]);

  // Prayer times only need recomputing once a minute (and when config / day
  // changes), even though `now` ticks every second for the countdown.
  const minuteBucket = Math.floor(now / 60_000);
  const prayer = useMemo(
    () =>
      computeTimes({
        lat: coords.lat,
        lng: coords.lng,
        methodKey: config.method,
        madhab: config.madhab,
        date: new Date(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coords.lat, coords.lng, config.method, config.madhab, minuteBucket, today],
  );

  const myName = room?.names?.[uid] || config.displayName || 'Me';
  const partnerName = partnerUid ? room?.names?.[partnerUid] || 'Partner' : null;

  const onToggle = useCallback(
    async (p: PrayerKey) => {
      const wasDone = myMarks[p] != null;
      tapFeedback(wasDone ? 'light' : 'success');
      try {
        await toggle(p);
      } catch {
        tapFeedback('warning');
      }
    },
    [toggle, myMarks],
  );

  const shareCode = useCallback(async () => {
    if (!config.roomId) return;
    try {
      await Share.share({
        message: `Track our daily Salah together on ${APP_NAME} 🕌\nRoom code: ${config.roomId}`,
      });
    } catch {
      // dismissed
    }
  }, [config.roomId]);

  const copyCode = useCallback(async () => {
    if (!config.roomId) return;
    await Clipboard.setStringAsync(config.roomId);
    tapFeedback('success');
  }, [config.roomId]);

  const allowLocation = useCallback(async () => {
    const result = await detectCoords();
    if (result.ok) {
      update({ coords: result.coords, dismissedLocationHint: true });
      tapFeedback('success');
    } else {
      update({ dismissedLocationHint: true });
      Alert.alert(
        'Location unavailable',
        'No problem — pick your city in Settings and prayer times will use that instead.',
      );
    }
  }, [update]);

  const showLocationHint =
    config.locationMode === 'gps' && !config.coords && !config.dismissedLocationHint;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { padding: m.pagePadding, gap: m.tiny ? 10 : 14 },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.brand, { color: t.text }]} numberOfLines={1}>
              {APP_NAME}
            </Text>
            <Text style={[styles.date, { color: t.textDim }]} numberOfLines={1}>
              {humanDate(new Date(now))}
            </Text>
          </View>
          <Pressable
            onPress={() => setSettingsOpen(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            style={[styles.gear, { borderColor: t.border, backgroundColor: t.surface }]}
          >
            <Text style={styles.gearIcon}>⚙︎</Text>
          </Pressable>
        </View>

        <WindowBanner
          metrics={m}
          times={prayer.times}
          currentKey={prayer.currentKey}
          next={prayer.next}
          now={now}
        />

        {showLocationHint ? (
          <LocationHint
            t={t}
            onAllow={allowLocation}
            onPickCity={() => setSettingsOpen(true)}
            onDismiss={() => update({ dismissedLocationHint: true })}
          />
        ) : null}

        {error ? (
          <Pressable
            onPress={() => setError(null)}
            style={[styles.errorBox, { borderColor: t.danger, backgroundColor: t.surface }]}
          >
            <Text style={[styles.errorText, { color: t.danger }]}>{error}</Text>
            <Text style={[styles.errorDismiss, { color: t.textDim }]}>Tap to dismiss</Text>
          </Pressable>
        ) : null}

        {loading && !room ? (
          <View style={styles.loading}>
            <ActivityIndicator color={t.primary} />
          </View>
        ) : (
          <PrayerTable
            metrics={m}
            myName={myName}
            partnerName={partnerName}
            myMarks={myMarks}
            partnerMarks={partnerMarks}
            times={prayer.times}
            currentKey={prayer.currentKey}
            onToggle={onToggle}
          />
        )}

        {!loading && !partnerUid ? (
          <InviteCard
            t={t}
            m={m}
            code={config.roomId ?? '—'}
            onCopy={copyCode}
            onShare={shareCode}
          />
        ) : null}

        <Text style={[styles.footer, { color: t.textDim }]} numberOfLines={2}>
          Room {config.roomId} · resets at midnight · live sync
        </Text>
      </ScrollView>

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        myName={myName}
        code={config.roomId}
        onRename={async (name) => {
          await rename(name);
          update({ displayName: name });
        }}
        onLeave={async () => {
          await leave();
          update({ roomId: null });
          setSettingsOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Local components                                                    */
/* ------------------------------------------------------------------ */

function InviteCard({
  t,
  m,
  code,
  onCopy,
  onShare,
}: {
  t: Theme;
  m: Metrics;
  code: string;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <View
      style={[
        styles.invite,
        { backgroundColor: t.surfaceAlt, borderColor: t.border, padding: m.cardPadding + 2 },
      ]}
    >
      <Text style={[styles.inviteTitle, { color: t.text }]}>Invite your partner</Text>
      <Text style={[styles.inviteBody, { color: t.textDim }]}>
        Share this code. They enter it on their phone to pair, and the second column fills in.
      </Text>
      <View style={[styles.inviteCodeBox, { borderColor: t.border, backgroundColor: t.surface }]}>
        <Text
          style={[styles.inviteCode, { color: t.primary, letterSpacing: m.tiny ? 4 : 8 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {code}
        </Text>
      </View>
      <View style={m.tiny ? styles.inviteButtonsStacked : styles.inviteButtonsRow}>
        {/* `flex: 1` only makes sense while the buttons sit side by side; in a
            column it would stretch them vertically. */}
        <Button label="Share" onPress={onShare} style={m.tiny ? undefined : styles.grow} />
        <Button
          label="Copy code"
          variant="secondary"
          onPress={onCopy}
          style={m.tiny ? undefined : styles.grow}
        />
      </View>
    </View>
  );
}

function LocationHint({
  t,
  onAllow,
  onPickCity,
  onDismiss,
}: {
  t: Theme;
  onAllow: () => void;
  onPickCity: () => void;
  onDismiss: () => void;
}) {
  return (
    <View style={[styles.hint, { backgroundColor: t.surface, borderColor: t.border }]}>
      <View style={styles.hintTextWrap}>
        <Text style={[styles.hintTitle, { color: t.text }]}>Use your location?</Text>
        <Text style={[styles.hintBody, { color: t.textDim }]}>
          For accurate prayer times where you are.
        </Text>
      </View>
      <View style={styles.hintActions}>
        <Pressable onPress={onAllow} hitSlop={8}>
          <Text style={[styles.hintAllow, { color: t.primary }]}>Allow</Text>
        </Pressable>
        <Pressable onPress={onPickCity} hitSlop={8}>
          <Text style={[styles.hintSecondary, { color: t.textDim }]}>Pick city</Text>
        </Pressable>
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={[styles.hintSecondary, { color: t.textDim }]}>Dismiss</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  date: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { fontSize: 18 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  errorBox: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 2 },
  errorText: { fontSize: 13, fontWeight: '700' },
  errorDismiss: { fontSize: 11 },
  footer: { fontSize: 11, textAlign: 'center', marginTop: 6 },

  invite: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  inviteTitle: { fontSize: 15, fontWeight: '800' },
  inviteBody: { fontSize: 12, lineHeight: 17 },
  inviteCodeBox: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  inviteCode: { fontSize: 26, fontWeight: '900' },
  inviteButtonsRow: { flexDirection: 'row', gap: 8 },
  inviteButtonsStacked: { gap: 8 },
  grow: { flex: 1 },

  hint: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 10,
  },
  hintTextWrap: { gap: 2 },
  hintTitle: { fontSize: 14, fontWeight: '800' },
  hintBody: { fontSize: 12 },
  hintActions: { flexDirection: 'row', gap: 18, alignItems: 'center', flexWrap: 'wrap' },
  hintAllow: { fontSize: 13, fontWeight: '800' },
  hintSecondary: { fontSize: 13, fontWeight: '600' },
});
