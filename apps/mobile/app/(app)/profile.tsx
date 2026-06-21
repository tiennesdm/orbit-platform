/**
 * Profile — user info + logout
 */

import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useAuth } from '@/store/auth';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function Profile() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const handleLogout = () => {
    Alert.alert('Log out?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.handle || '?').slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>@{user?.handle ?? 'me'}</Text>
        <Text style={styles.did}>{user?.did}</Text>
      </View>

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
    </View>
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
  logoutButton: {
    backgroundColor: colors.danger,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: 'auto',
  },
  logoutText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
});
