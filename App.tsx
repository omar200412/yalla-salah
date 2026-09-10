import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { APP_NAME } from './src/config/constants';
import { AppStateProvider, useAppState } from './src/state/AppStateContext';
import { useAuth } from './src/state/useAuth';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { useTheme } from './src/theme/colors';

function Gate() {
  const t = useTheme();
  const { config, ready: configReady } = useAppState();
  const { uid, ready: authReady, error } = useAuth();

  if (!configReady || !authReady) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <StatusBar style={t.mode === 'dark' ? 'light' : 'dark'} />
        <Text style={[styles.logo, { color: t.primary }]}>☾</Text>
        <Text style={[styles.brand, { color: t.text }]}>{APP_NAME}</Text>
        <ActivityIndicator color={t.primary} style={styles.spinner} />
        {error ? <Text style={[styles.error, { color: t.danger }]}>{error}</Text> : null}
      </View>
    );
  }

  if (!uid || !config.roomId) {
    return <OnboardingScreen uid={uid} />;
  }

  return <DashboardScreen uid={uid} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <Gate />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  logo: { fontSize: 48, lineHeight: 56 },
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  spinner: { marginTop: 12 },
  error: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 12 },
});
