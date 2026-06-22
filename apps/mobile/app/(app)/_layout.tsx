/**
 * Authenticated app layout — tab navigation
 *
 * Tabs: Home · Discover · Compose · Inbox · Reels (Reels opens as modal)
 * Profile accessible from Home header
 */

import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/store/auth';
import { colors } from '@/lib/theme';
import { Home, Search, PlusSquare, Inbox, Film, User } from 'lucide-react-native';

export default function AppLayout() {
  const { isHydrated, token, hydrate } = useAuth();

  useEffect(() => {
    if (!isHydrated) hydrate();
  }, [isHydrated, hydrate]);

  if (!isHydrated) return null;
  if (!token) return <Redirect href="/(onboarding)" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.elevated,
          borderTopColor: colors.hairline,
          borderTopWidth: 0.5,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="compose"
        options={{
          title: 'Post',
          tabBarIcon: ({ color, size }) => <PlusSquare size={size + 4} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarIcon: ({ color, size }) => <Inbox size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          tabBarIcon: ({ color, size }) => <Film size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="groups"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="stories"
        options={{ href: null }}
      />
    </Tabs>
  );
}
