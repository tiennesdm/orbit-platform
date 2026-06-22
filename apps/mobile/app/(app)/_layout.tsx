/**
 * Authenticated app layout — tab navigation
 */

import { useEffect } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/store/auth';
import { colors } from '@/lib/theme';
import { Home, Search, PlusSquare, Inbox, User } from 'lucide-react-native';

export default function AppLayout() {
  // Subscribe to each piece individually so re-renders fire on changes
  const isHydrated = useAuth((s) => s.isHydrated);
  const token = useAuth((s) => s.token);
  const hydrate = useAuth((s) => s.hydrate);

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
        },
        tabBarActiveTintColor: colors.text.primary,
        tabBarInactiveTintColor: colors.text.tertiary,
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
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="compose"
        options={{
          title: 'Post',
          tabBarIcon: ({ color, size }) => <PlusSquare size={size} color={color} />,
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
