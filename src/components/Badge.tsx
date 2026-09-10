import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/colors';

type Tone = 'neutral' | 'active' | 'done' | 'muted';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = useTheme();

  const colors: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: t.surfaceAlt, fg: t.textDim },
    active: { bg: t.accent, fg: t.onAccent },
    done: { bg: t.primary, fg: t.onPrimary },
    muted: { bg: 'transparent', fg: t.textDim },
  };

  return (
    <View style={[styles.badge, { backgroundColor: colors[tone].bg }]}>
      <Text style={[styles.text, { color: colors[tone].fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});
