/**
 * Stories — 24h ephemeral posts
 */

import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Image as ImageIcon, MapPin, Users, X, Eye, Clock } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_STORIES = [
  { id: 's1', authorHandle: 'alice', authorName: 'Alice', text: 'Coffee + code = perfect morning ☕', at: Date.now() - 2 * 3600_000, expires: Date.now() + 22 * 3600_000, viewCount: 23, hasViewed: false },
  { id: 's2', authorHandle: 'bob', authorName: 'Bob', text: 'Just shipped the new feature 🚀', at: Date.now() - 8 * 3600_000, expires: Date.now() + 16 * 3600_000, viewCount: 47, hasViewed: false },
  { id: 's3', authorHandle: 'carol', authorName: 'Carol', text: 'Walking through the new park 🌳', at: Date.now() - 1 * 3600_000, expires: Date.now() + 23 * 3600_000, viewCount: 12, hasViewed: true },
];

export default function Stories() {
  const [composing, setComposing] = useState(false);

  if (composing) return <ComposeStory onClose={() => setComposing(false)} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Stories</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}>
        <Pressable onPress={() => setComposing(true)} style={styles.addCard}>
          <Text style={styles.addEmoji}>✨</Text>
          <Text style={styles.addText}>+ Add to your story</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>From people you follow</Text>
        {MOCK_STORIES.map((s) => (
          <View key={s.id} style={styles.storyCard}>
            <View style={s.hasViewed ? styles.avatarViewed : styles.avatarUnviewed}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{s.authorName[0]}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.author}>{s.authorName}</Text>
              <Text style={styles.text}>{s.text}</Text>
              <View style={styles.meta}>
                <Clock size={10} color={colors.text.tertiary} />
                <Text style={styles.metaText}>{timeAgo(s.at)} · {timeLeft(s.expires)}</Text>
              </View>
            </View>
            <View style={styles.viewCount}>
              <Eye size={12} color={colors.text.tertiary} />
              <Text style={styles.viewText}>{s.viewCount}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function ComposeStory({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');

  const post = useMutation({
    mutationFn: () => api.createStory({ text }),
    onSuccess: onClose,
    onError: (e: any) => Alert.alert('Failed', e.message),
  });

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) Alert.alert('Image added', 'Will be uploaded with the story');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.iconBtn}>
          <X size={20} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>New story</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Share a moment... (24h ephemeral)"
          placeholderTextColor={colors.text.tertiary}
          multiline
          style={styles.input}
        />
        <View style={styles.tools}>
          <Pressable style={styles.tool} onPress={pickImage}>
            <ImageIcon size={18} color={colors.text.secondary} />
            <Text style={styles.toolText}>Photo</Text>
          </Pressable>
          <Pressable style={styles.tool}>
            <MapPin size={18} color={colors.text.secondary} />
            <Text style={styles.toolText}>Location</Text>
          </Pressable>
          <Pressable style={styles.tool}>
            <Users size={18} color={colors.text.secondary} />
            <Text style={styles.toolText}>Close friends</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => post.mutate()}
          disabled={!text.trim() || post.isPending}
          style={[styles.submitBtn, (!text.trim() || post.isPending) && { opacity: 0.5 }]}
        >
          <Text style={styles.submitText}>{post.isPending ? 'Posting…' : 'Post story'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function timeAgo(ts: number): string {
  const h = Math.floor((Date.now() - ts) / 3600_000);
  if (h < 1) return `${Math.floor((Date.now() - ts) / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function timeLeft(expires: number): string {
  const h = Math.floor((expires - Date.now()) / 3600_000);
  if (h < 1) return `${Math.floor((expires - Date.now()) / 60_000)}m left`;
  if (h < 24) return `${h}h left`;
  return `${Math.floor(h / 24)}d left`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.subtle, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.size.xl, ...typography.weight.bold, color: colors.text.primary, flex: 1 },
  addCard: { backgroundColor: colors.accent.DEFAULT, padding: spacing.lg, borderRadius: radius.lg, alignItems: 'center', marginBottom: spacing.lg },
  addEmoji: { fontSize: 32 },
  addText: { color: '#fff', ...typography.size.base, ...typography.weight.semibold, marginTop: spacing.xs },
  sectionTitle: { ...typography.size.sm, ...typography.weight.semibold, color: colors.text.tertiary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  storyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg.subtle, borderRadius: radius.lg, marginBottom: spacing.sm },
  avatarUnviewed: { width: 56, height: 56, borderRadius: 28, padding: 2, backgroundColor: colors.accent.DEFAULT },
  avatarViewed: { width: 56, height: 56, borderRadius: 28, padding: 2, backgroundColor: colors.bg.elevated },
  avatar: { flex: 1, borderRadius: 26, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', ...typography.weight.bold, fontSize: 20 },
  author: { ...typography.weight.semibold, color: colors.text.primary, fontSize: 15 },
  text: { ...typography.size.sm, color: colors.text.secondary, lineHeight: 18, marginTop: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  metaText: { ...typography.size.xs, color: colors.text.tertiary },
  viewCount: { alignItems: 'center', gap: 2 },
  viewText: { ...typography.size.xs, color: colors.text.tertiary },
  input: { backgroundColor: colors.bg.subtle, borderRadius: radius.md, padding: spacing.md, ...typography.size.base, color: colors.text.primary, minHeight: 120, textAlignVertical: 'top' },
  tools: { flexDirection: 'row', gap: spacing.sm },
  tool: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.md, backgroundColor: colors.bg.subtle, borderRadius: radius.md },
  toolText: { ...typography.size.sm, color: colors.text.secondary },
  submitBtn: { backgroundColor: colors.accent.DEFAULT, padding: spacing.md, borderRadius: radius.lg, alignItems: 'center' },
  submitText: { color: '#fff', ...typography.size.base, ...typography.weight.semibold },
});
