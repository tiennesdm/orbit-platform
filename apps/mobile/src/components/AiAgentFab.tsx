/**
 * AI Agent FAB — floating action button for AI co-creation
 * (Phase 2: full chat bottom-sheet — for now, opens /ai-cocreate)
 */

import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { colors, spacing } from '@/lib/theme';

export default function AiAgentFab() {
  const router = useRouter();
  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={() => router.push('/(app)/ai-cocreate')}
        accessibilityLabel="Open AI Co-Create"
        accessibilityRole="button"
      >
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
  fabPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
