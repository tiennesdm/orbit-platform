/**
 * Onboarding — welcome screen
 */

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@/lib/theme';

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🪐</Text>
      <Text style={styles.title}>Welcome to ORBIT</Text>
      <Text style={styles.subtitle}>
        The social network that works for you, not on you.
      </Text>
      <Pressable
        style={styles.button}
        onPress={() => router.push('/(onboarding)/handle')}
      >
        <Text style={styles.buttonText}>Get started →</Text>
      </Pressable>
      <Pressable onPress={() => router.push('/(onboarding)/login')}>
        <Text style={styles.linkText}>Already have an account? Log in</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  emoji: { fontSize: 80, textAlign: 'center', marginBottom: spacing.xl },
  title: {
    ...typography.size.xxxl,
    ...typography.weight.black,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: -1,
  },
  subtitle: {
    ...typography.size.md,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  button: {
    backgroundColor: colors.text.primary,
    paddingVertical: spacing.lg,
    borderRadius: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
  linkText: {
    color: colors.text.secondary,
    textAlign: 'center',
    padding: spacing.md,
    ...typography.weight.semibold,
  },
});
