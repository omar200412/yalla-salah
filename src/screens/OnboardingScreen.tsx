import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { APP_NAME, NAME_MAX_LENGTH } from '../config/constants';
import { isValidCode, normalizeCode } from '../lib/code';
import { tapFeedback } from '../lib/haptics';
import { useAppState } from '../state/AppStateContext';
import { createRoom, joinRoom } from '../state/useRoomSync';
import { useTheme } from '../theme/colors';

type Mode = 'choose' | 'join';

export function OnboardingScreen({ uid }: { uid: string | null }) {
  const t = useTheme();
  const { update } = useAppState();

  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('choose');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<null | 'create' | 'join'>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOk = name.trim().length >= 1;
  const connecting = !uid;

  async function handleCreate() {
    if (!uid || !nameOk) return;
    setBusy('create');
    setError(null);
    try {
      const newCode = await createRoom(uid, name);
      tapFeedback('success');
      update({ displayName: name.trim(), roomId: newCode });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create a room.');
      tapFeedback('warning');
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    if (!uid || !nameOk) return;
    if (!isValidCode(code)) {
      setError('Enter the full 6-digit code.');
      return;
    }
    setBusy('join');
    setError(null);
    try {
      await joinRoom(uid, name, code.trim());
      tapFeedback('success');
      update({ displayName: name.trim(), roomId: code.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not join that room.');
      tapFeedback('warning');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Text style={[styles.crescent, { color: t.primary }]}>☾</Text>
            <Text style={[styles.brand, { color: t.text }]}>{APP_NAME}</Text>
            <Text style={[styles.tagline, { color: t.textDim }]}>
              Keep each other on track, five times a day.
            </Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="Your name"
              placeholder="e.g. Dad, Omar"
              value={name}
              onChangeText={setName}
              maxLength={NAME_MAX_LENGTH}
              autoCapitalize="words"
              returnKeyType="done"
            />

            {mode === 'choose' ? (
              <View style={styles.actions}>
                <Button
                  label="Create a room"
                  onPress={handleCreate}
                  disabled={!nameOk || connecting}
                  loading={busy === 'create'}
                />
                <Button
                  label="I have a code"
                  variant="ghost"
                  onPress={() => {
                    setError(null);
                    setMode('join');
                  }}
                  disabled={connecting}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <TextField
                  label="6-digit room code"
                  placeholder="000000"
                  value={code}
                  onChangeText={(v) => setCode(normalizeCode(v))}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={styles.codeInput}
                />
                <Button
                  label="Join room"
                  onPress={handleJoin}
                  disabled={!nameOk || !isValidCode(code) || connecting}
                  loading={busy === 'join'}
                />
                <Button
                  label="Back"
                  variant="ghost"
                  onPress={() => {
                    setError(null);
                    setMode('choose');
                  }}
                />
              </View>
            )}

            {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
            {connecting ? (
              <Text style={[styles.note, { color: t.textDim }]}>Connecting to the sync service…</Text>
            ) : null}
          </View>

          <Text style={[styles.footnote, { color: t.textDim }]}>
            Share the room code with one other person. Only the two of you can see each other&apos;s
            checklist.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: 24, justifyContent: 'center', gap: 32 },
  hero: { alignItems: 'center', gap: 6 },
  crescent: { fontSize: 56, lineHeight: 64 },
  brand: { fontSize: 30, fontWeight: '800', letterSpacing: 0.3 },
  tagline: { fontSize: 15, fontWeight: '500', textAlign: 'center' },
  form: { gap: 18 },
  actions: { gap: 12 },
  codeInput: {
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '800',
    textAlign: 'center',
  },
  error: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  note: { fontSize: 12, textAlign: 'center' },
  footnote: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
