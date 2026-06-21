/**
 * Compose — create a new post
 */

import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

const MODES = ['public', 'intimate', 'visual', 'community'] as const;
type Mode = (typeof MODES)[number];

export default function Compose() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<Mode>('public');
  const [loading, setLoading] = useState(false);

  const onPost = async () => {
    if (!content.trim()) {
      Alert.alert('Empty post', 'Write something first');
      return;
    }
    setLoading(true);
    try {
      await api.createPost({ mode, contentText: content.trim(), visibility: 'public' });
      router.replace('/(app)');
    } catch (e: any) {
      Alert.alert('Failed to post', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New post</Text>

      <View style={styles.modes}>
        {MODES.map((m) => (
          <Pressable
            key={m}
            style={[styles.modePill, mode === m && styles.modePillActive]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modePillText, mode === m && styles.modePillTextActive]}>{m}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder={`What's on your mind? (${mode} mode)`}
        placeholderTextColor={colors.text.tertiary}
        value={content}
        onChangeText={setContent}
        multiline
        autoFocus
      />

      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={onPost} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.text.inverse} /> : <Text style={styles.buttonText}>Post</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated, padding: spacing.xl, paddingTop: spacing.xxxl },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, marginBottom: spacing.lg },
  modes: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  modePill: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.bg.subtle },
  modePillActive: { backgroundColor: colors.accent.DEFAULT },
  modePillText: { ...typography.size.sm, ...typography.weight.semibold, color: colors.text.secondary, textTransform: 'capitalize' },
  modePillTextActive: { color: colors.text.inverse },
  input: {
    flex: 1,
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    fontSize: typography.size.md,
    color: colors.text.primary,
    textAlignVertical: 'top',
  },
  button: { backgroundColor: colors.text.primary, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
});
