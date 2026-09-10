import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { APP_NAME, APP_VERSION, METHODS, NAME_MAX_LENGTH } from '../config/constants';
import { tapFeedback } from '../lib/haptics';
import { CITIES, findCity } from '../services/cities';
import { detectCoords } from '../services/location';
import { useAppState } from '../state/AppStateContext';
import { useTheme, type Theme } from '../theme/colors';
import { LocationMode, Madhab, MethodKey } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  myName: string;
  code: string | null;
  onRename: (name: string) => Promise<void>;
  onLeave: () => Promise<void>;
};

export function SettingsModal({ visible, onClose, myName, code, onRename, onLeave }: Props) {
  const t = useTheme();
  const { config, update } = useAppState();

  const [name, setName] = useState(myName);
  const [savingName, setSavingName] = useState(false);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    if (visible) setName(myName);
  }, [visible, myName]);

  async function handleSaveName() {
    const trimmed = name.trim() || 'Me';
    setSavingName(true);
    try {
      await onRename(trimmed);
      tapFeedback('success');
    } catch {
      Alert.alert('Could not save', 'Check your connection and try again.');
    } finally {
      setSavingName(false);
    }
  }

  async function handleCopyCode() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    tapFeedback('success');
  }

  async function handleShareCode() {
    if (!code) return;
    try {
      await Share.share({
        message: `Track our daily Salah together on ${APP_NAME}.\nRoom code: ${code}`,
      });
    } catch {
      // user dismissed the share sheet
    }
  }

  async function handleDetect() {
    setDetecting(true);
    try {
      const result = await detectCoords();
      if (result.ok) {
        update({ coords: result.coords, locationMode: 'gps', dismissedLocationHint: true });
        tapFeedback('success');
      } else {
        Alert.alert(
          'Location unavailable',
          result.reason === 'denied'
            ? 'Permission was denied. Enable location for Yalla Salah in system settings, or pick a city instead.'
            : 'Could not get a location fix. Pick a city instead.',
        );
      }
    } finally {
      setDetecting(false);
    }
  }

  function confirmLeave() {
    Alert.alert('Leave this room?', 'You can rejoin later with the same 6-digit code.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => void onLeave() },
    ]);
  }

  const city = findCity(config.cityId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
        <View style={[styles.head, { borderBottomColor: t.border }]}>
          <Text style={[styles.title, { color: t.text }]}>Settings</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.done, { color: t.primary }]}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Section t={t} title="Display name">
            <TextField
              value={name}
              onChangeText={setName}
              maxLength={NAME_MAX_LENGTH}
              placeholder="Your name"
              autoCapitalize="words"
            />
            <Button label="Save name" onPress={handleSaveName} loading={savingName} />
          </Section>

          <Section t={t} title="Room code" hint="Share this with the other person so they can join.">
            <View style={[styles.codeBox, { borderColor: t.border, backgroundColor: t.surface }]}>
              <Text style={[styles.code, { color: t.text }]}>{code ?? '—'}</Text>
            </View>
            <View style={styles.rowGap}>
              <Button label="Copy" variant="secondary" style={styles.grow} onPress={handleCopyCode} />
              <Button label="Share" variant="secondary" style={styles.grow} onPress={handleShareCode} />
            </View>
          </Section>

          <Section t={t} title="Location">
            <Segmented<LocationMode>
              t={t}
              value={config.locationMode}
              onChange={(mode) => update({ locationMode: mode })}
              options={[
                { key: 'gps', label: 'Use GPS' },
                { key: 'manual', label: 'Pick a city' },
              ]}
            />

            {config.locationMode === 'gps' ? (
              <View style={styles.stack}>
                <Text style={[styles.hint, { color: t.textDim }]}>
                  {config.coords
                    ? `Using ${config.coords.lat.toFixed(3)}, ${config.coords.lng.toFixed(3)}`
                    : 'Location not set yet — tap below to detect it.'}
                </Text>
                <Button
                  label="Detect my location"
                  variant="secondary"
                  loading={detecting}
                  onPress={handleDetect}
                />
              </View>
            ) : (
              <OptionList
                t={t}
                value={config.cityId}
                onChange={(id) => {
                  const picked = findCity(id);
                  update({ cityId: id, method: picked.method });
                }}
                options={CITIES.map((c) => ({
                  key: c.id,
                  label: c.name,
                  note: c.country,
                }))}
              />
            )}
            {config.locationMode === 'manual' ? (
              <Text style={[styles.hint, { color: t.textDim }]}>
                Prayer times calculated for {city.name}, {city.country}.
              </Text>
            ) : null}
          </Section>

          <Section t={t} title="Calculation method">
            <OptionList<MethodKey>
              t={t}
              value={config.method}
              onChange={(key) => update({ method: key })}
              options={METHODS.map((m) => ({ key: m.key, label: m.label, note: m.note }))}
            />
          </Section>

          <Section t={t} title="Asr calculation">
            <Segmented<Madhab>
              t={t}
              value={config.madhab}
              onChange={(madhab) => update({ madhab })}
              options={[
                { key: 'shafi', label: 'Standard' },
                { key: 'hanafi', label: 'Hanafi' },
              ]}
            />
            <Text style={[styles.hint, { color: t.textDim }]}>
              Hanafi makes Asr later (shadow length ×2).
            </Text>
          </Section>

          <Section t={t} title="Danger zone">
            <Button label="Leave room" variant="danger" onPress={confirmLeave} />
          </Section>

          <Text style={[styles.version, { color: t.textDim }]}>
            {APP_NAME} v{APP_VERSION}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Local building blocks                                               */
/* ------------------------------------------------------------------ */

function Section({
  t,
  title,
  hint,
  children,
}: {
  t: Theme;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: t.textDim }]}>{title.toUpperCase()}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: t.textDim }]}>{hint}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Segmented<T extends string>({
  t,
  value,
  onChange,
  options,
}: {
  t: Theme;
  value: T;
  onChange: (value: T) => void;
  options: { key: T; label: string }[];
}) {
  return (
    <View style={[styles.segmented, { backgroundColor: t.surface, borderColor: t.border }]}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.segment, active && { backgroundColor: t.primary }]}
          >
            <Text
              style={[
                styles.segmentLabel,
                { color: active ? t.onPrimary : t.text },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OptionList<T extends string>({
  t,
  value,
  onChange,
  options,
}: {
  t: Theme;
  value: T;
  onChange: (value: T) => void;
  options: { key: T; label: string; note?: string }[];
}) {
  return (
    <View style={[styles.optionList, { borderColor: t.border, backgroundColor: t.surface }]}>
      {options.map((opt, index) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[
              styles.option,
              index > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={styles.optionText}>
              <Text style={[styles.optionLabel, { color: t.text }]}>{opt.label}</Text>
              {opt.note ? (
                <Text style={[styles.optionNote, { color: t.textDim }]}>{opt.note}</Text>
              ) : null}
            </View>
            <View
              style={[
                styles.radio,
                { borderColor: active ? t.primary : t.border },
                active && { backgroundColor: t.primary },
              ]}
            >
              {active ? <Text style={[styles.radioDot, { color: t.onPrimary }]}>✓</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '800' },
  done: { fontSize: 16, fontWeight: '700' },
  body: { padding: 20, gap: 26, paddingBottom: 48 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  sectionHint: { fontSize: 12, marginTop: -2 },
  sectionBody: { gap: 10, marginTop: 2 },
  stack: { gap: 10 },
  hint: { fontSize: 12 },
  rowGap: { flexDirection: 'row', gap: 10 },
  grow: { flex: 1 },
  codeBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  code: { fontSize: 30, fontWeight: '900', letterSpacing: 10 },
  segmented: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentLabel: { fontSize: 14, fontWeight: '700' },
  optionList: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 14, fontWeight: '700' },
  optionNote: { fontSize: 12, marginTop: 1 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { fontSize: 12, fontWeight: '900' },
  version: { fontSize: 12, textAlign: 'center', marginTop: 4 },
});
