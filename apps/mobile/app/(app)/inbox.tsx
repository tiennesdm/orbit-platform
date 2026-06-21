/**
 * Inbox — DM threads + notifications
 */

import { View, Text, FlatList, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function Inbox() {
  // TODO: wire up to actual /api/v1/dms/threads endpoint
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inbox</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>💬</Text>
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptyText}>
          DMs are end-to-end encrypted with the Signal Protocol. Start a conversation from someone's profile.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated, padding: spacing.xl, paddingTop: spacing.xxxl },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, marginBottom: spacing.xl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { ...typography.size.xl, ...typography.weight.bold, color: colors.text.primary, marginBottom: spacing.sm },
  emptyText: { ...typography.size.base, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
});
