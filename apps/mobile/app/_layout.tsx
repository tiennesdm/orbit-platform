/**
 * ORBIT Mobile App — Expo Router entry point
 *
 * Stack:
 *   - Expo SDK 52 + Expo Router (file-based routing)
 *   - React Native 0.76
 *   - Same shared packages (@orbit/types, @orbit/crypto, @orbit/db)
 *
 * Navigation:
 *   /(onboarding)   — signup, login, handle selection
 *   /(app)/         — authenticated tabs (home, search, compose, inbox, profile)
 */

import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'react-native';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: '#FAF8F4' },
          }}
        >
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
