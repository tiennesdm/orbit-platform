/**
 * Login screen (stub — uses /identity/signup flow instead for MVP)
 */

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // MVP: re-signup as login since we don't have a real login route yet.
  // Production: WebAuthn passkey login flow (see apps/api/src/modules/identity/webauthn.service.ts).
  const onSubmit = async () => {
    setError(null);
    if (!handle || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      // Try signup first (works if user doesn't exist)
      try {
        const cleanHandle = handle.replace(/^@/, '');
        // Use handle as a default display name only if user didn't provide one
        // (signup endpoint requires a non-empty display name)
        const session = await api.signup(cleanHandle, cleanHandle, password);
        await api.setSession(session);
        router.replace('/(app)');
        return;
      } catch (signupErr) {
        // User exists — try login via WebAuthn in production
        setError('Login via passkey only. Use signup if you don\'t have an account.');
      }
    } catch (e) {
      const err = e as ApiError;
      setError(err.message ?? 'Login failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back.</Text>
      <Text style={styles.subtitle}>Log in to ORBIT.</Text>

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

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.text.tertiary}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={onSubmit}>
        <Text style={styles.buttonText}>Log in →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated, padding: spacing.xl, paddingTop: spacing.xxxl * 2 },
  title: { ...typography.size.xxxl, ...typography.weight.black, color: colors.text.primary },
  subtitle: { ...typography.size.lg, color: colors.text.secondary, marginBottom: spacing.xxxl },
  label: { ...typography.weight.semibold, ...typography.size.sm, color: colors.text.secondary, marginTop: spacing.lg, marginBottom: spacing.sm },
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
  buttonText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
  error: { color: colors.danger, marginTop: spacing.md, ...typography.size.sm },
});
