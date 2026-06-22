/**
 * ORBIT Mobile App Entry — Expo Router
 *
 * Root route: redirects to (onboarding) or (app) based on auth state.
 * Auth hydration is async (zustand persist + SecureStore), so we wait for
 * hasHydrated before deciding where to go.
 */

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/auth';
import { colors } from '@/lib/theme';

export default function RootIndex() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const isHydrated = useAuth((s) => s.isHydrated);
  const hydrate = useAuth((s) => s.hydrate);

  useEffect(() => {
    // Kick off hydration on mount (idempotent — store guards against double-load)
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  useEffect(() => {
    if (!isHydrated) return; // wait for persist to load from SecureStore / localStorage
    if (user) {
      router.replace('/(app)');
    } else {
      router.replace('/(onboarding)');
    }
  }, [isHydrated, user, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent.DEFAULT} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
