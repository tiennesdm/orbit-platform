/**
 * Handle selection — pick a unique handle
 */

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/auth';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { ApiError } from '@/lib/api';

export default function HandleScreen() {
  const router = useRouter();
  const signup = useAuth((s) => s.signup);
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!handle || !displayName || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await signup(handle.replace(/^@/, ''), displayName, password);
      router.replace('/(app)');
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'Conflict') {
        setError(`Handle @${handle} is already taken`);
      } else {
        setError(e?.message ?? 'Signup failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your handle is yours.</Text>
      <Text style={styles.subtitle}>Forever.</Text>
      <Text style={styles.helper}>
        Pick a handle. We'll generate cryptographic keys so your identity, followers, and history
        move with you — even if ORBIT shuts down.
      </Text>

      <Text style={styles.label}>Handle</Text>
      <TextInput
        style={styles.input}
        placeholder="@yourname"
        placeholderTextColor={colors.text.tertiary}
        value={handle}
        onChangeText={setHandle}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Display name</Text>
      <TextInput
        style={styles.input}
        placeholder="Your Name"
        placeholderTextColor={colors.text.tertiary}
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="At least 8 characters"
        placeholderTextColor={colors.text.tertiary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color={colors.text.inverse} /> : (
          <Text style={styles.buttonText}>Create account →</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    padding: spacing.xl,
    paddingTop: spacing.xxxl * 2,
  },
  title: {
    ...typography.size.xxxl,
    ...typography.weight.black,
    color: colors.text.primary,
    letterSpacing: -1,
  },
  subtitle: {
    ...typography.size.xxxl,
    ...typography.weight.black,
    color: colors.accent.DEFAULT,
    letterSpacing: -1,
    marginBottom: spacing.md,
  },
  helper: {
    ...typography.size.base,
    color: colors.text.secondary,
    marginBottom: spacing.xxxl,
    lineHeight: 22,
  },
  label: {
    ...typography.weight.semibold,
    ...typography.size.sm,
    color: colors.text.secondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    fontFamily: typography.fontFamily.mono,
    color: colors.text.primary,
  },
  button: {
    backgroundColor: colors.text.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
  error: {
    color: colors.danger,
    marginTop: spacing.md,
    ...typography.size.sm,
  },
});
