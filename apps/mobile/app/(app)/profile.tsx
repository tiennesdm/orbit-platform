/**
 * Profile — user info + settings + logout
 */

import { View, Text, StyleSheet, Pressable, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/auth';
import { Settings, ChevronRight, LogOut, Download, Bot, Bell } from 'lucide-react-native';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function Profile() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const handleLogout = () => {
    Alert.alert('Log out?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.handle || '?').slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>@{user?.handle ?? 'me'}</Text>
        <Text style={styles.did}>{user?.did}</Text>
      </View>

      <Pressable style={styles.menuItem} onPress={() => router.push('/(app)/settings')}>
        <View style={[styles.menuIcon, { backgroundColor: colors.bg.subtle }]}>
          <Settings size={18} color={colors.text.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuTitle}>Settings</Text>
          <Text style={styles.menuSubtitle}>AI agent, privacy, GDPR, anti-addiction</Text>
        </View>
        <ChevronRight size={18} color={colors.text.tertiary} />
      </Pressable>

      <Pressable style={styles.menuItem} onPress={() => router.push('/(app)/stories')}>
        <View style={[styles.menuIcon, { backgroundColor: colors.accent.soft }]}>
          <Bell size={18} color={colors.accent.DEFAULT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuTitle}>Stories</Text>
          <Text style={styles.menuSubtitle}>24h ephemeral posts</Text>
        </View>
        <ChevronRight size={18} color={colors.text.tertiary} />
      </Pressable>

      <Pressable style={styles.menuItem} onPress={() => router.push('/(app)/marketplace')}>
        <View style={[styles.menuIcon, { backgroundColor: colors.accent.soft }]}>
          <Download size={18} color={colors.accent.DEFAULT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuTitle}>Marketplace</Text>
          <Text style={styles.menuSubtitle}>Buy &amp; sell in your community</Text>
        </View>
        <ChevronRight size={18} color={colors.text.tertiary} />
      </Pressable>

      <Pressable style={styles.menuItem} onPress={() => router.push('/(app)/groups')}>
        <View style={[styles.menuIcon, { backgroundColor: colors.accent.soft }]}>
          <Bot size={18} color={colors.accent.DEFAULT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.menuTitle}>Groups</Text>
          <Text style={styles.menuSubtitle}>Public, private, invite communities</Text>
        </View>
        <ChevronRight size={18} color={colors.text.tertiary} />
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Portable Identity</Text>
        <Text style={styles.sectionText}>
          Your identity is yours. Export your data vault from Settings → Identity → Export to take
          your followers, posts, and history to any ORBIT-compatible server.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI Agent</Text>
        <Text style={styles.sectionText}>
          Your AI agent respects your autonomy level. Set "ask", "suggest", or "auto" in Settings.
        </Text>
      </View>

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated, padding: spacing.xl, paddingTop: spacing.xxxl },
  header: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xxl },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accent.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { color: colors.text.inverse, fontSize: 32, ...typography.weight.bold },
  name: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary },
  did: { ...typography.size.xs, ...typography.fontFamily.mono, color: colors.text.tertiary },
  section: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.size.md, ...typography.weight.bold, color: colors.text.primary },
  sectionText: { ...typography.size.base, color: colors.text.secondary, lineHeight: 22 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg.subtle, borderRadius: radius.lg },
  menuIcon: { width: 40, height: 40, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  menuTitle: { ...typography.size.base, ...typography.weight.semibold, color: colors.text.primary },
  menuSubtitle: { ...typography.size.sm, color: colors.text.tertiary, marginTop: 2 },
  logoutButton: {
    backgroundColor: colors.danger,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  logoutText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
});
