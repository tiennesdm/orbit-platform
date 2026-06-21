/**
 * AI Agent FAB — floating action button for AI chat
 * (Phase 2: slide-up bottom sheet with chat UI)
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { colors, spacing } from '@/lib/theme';

export default function AiAgentFab() {
  const router = useRouter();
  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable style={styles.fab} onPress={() => router.push('/(app)/ai-chat')}>
        <Sparkles size={24} color={colors.text.inverse} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: spacing.lg,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.ai.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.ai.DEFAULT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
