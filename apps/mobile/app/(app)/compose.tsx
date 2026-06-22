/**
 * Compose — 4-mode selector (intimate / public / visual / community)
 * + image upload via expo-image-picker
 */

import { useState, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Image, ScrollView,
  ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  X, Image as ImageIcon, Hash, AtSign, Smile, MapPin, Lock, Users, Globe, Sparkles,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

const MODES = [
  { id: 'intimate', label: 'Intimate', icon: Lock, color: '#F59E0B', desc: 'Close friends only' },
  { id: 'public', label: 'Public', icon: Globe, color: colors.accent.DEFAULT, desc: 'Everyone' },
  { id: 'visual', label: 'Visual', icon: ImageIcon, color: '#EC4899', desc: 'Image-led post' },
  { id: 'community', label: 'Community', icon: Users, color: '#06B6D4', desc: 'Post in a group' },
] as const;

type Mode = typeof MODES[number]['id'];

export default function Compose() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('public');
  const [text, setText] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const publish = useMutation({
    mutationFn: async () => {
      let mediaIds: string[] = [];
      if (mediaUri) {
        setUploading(true);
        try {
          // Get presigned URL
          const presign = await api.getPresignedUpload('image/jpeg', 1024 * 1024);
          if (presign.key) {
            // For local mode, we just register the key
            const reg = await api.registerMedia({
              key: presign.key,
              type: 'image',
              mimeType: 'image/jpeg',
              bytes: 0,
            });
            mediaIds = [reg.id];
          }
        } catch (err) {
          // Media upload is best-effort
          console.warn('Media upload skipped:', err);
        } finally {
          setUploading(false);
        }
      }
      return api.createPost({ mode, contentText: text, visibility: 'public' });
    },
    onSuccess: () => {
      Keyboard.dismiss();
      router.replace('/(app)');
    },
    onError: (err: any) => {
      Alert.alert('Publish failed', err.message || 'Try again');
    },
  });

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      if (mode !== 'visual') setMode('visual');
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <X size={20} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>New {MODES.find((m) => m.id === mode)?.label} post</Text>
        <Pressable
          onPress={() => publish.mutate()}
          disabled={(!text.trim() && !mediaUri) || publish.isPending}
          style={[
            styles.publishBtn,
            ((!text.trim() && !mediaUri) || publish.isPending) && styles.publishBtnDisabled,
          ]}
        >
          {publish.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.publishText}>Post</Text>
          )}
        </Pressable>
      </View>

      {/* Mode selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.modesRow}
        style={styles.modesScroll}
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <Pressable
              key={m.id}
              onPress={() => setMode(m.id)}
              style={[styles.modeChip, active && styles.modeChipActive]}
            >
              <View style={[styles.modeIcon, { backgroundColor: m.color }]}>
                <Icon size={14} color="#fff" />
              </View>
              <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Media preview */}
      {mediaUri && (
        <View style={styles.mediaWrap}>
          <Image source={{ uri: mediaUri }} style={styles.media} />
          <Pressable onPress={() => setMediaUri(null)} style={styles.removeMedia}>
            <X size={16} color="#fff" />
          </Pressable>
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.uploadingText}>Uploading…</Text>
            </View>
          )}
        </View>
      )}

      {/* Composer */}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={
          mode === 'intimate' ? 'Share with close friends…' :
          mode === 'public' ? "What's on your mind?" :
          mode === 'visual' ? 'Write a caption…' :
          'Post in a community…'
        }
        placeholderTextColor={colors.text.tertiary}
        multiline
        maxLength={5000}
        style={styles.input}
      />

      {/* Toolbar */}
      <View style={styles.toolbar}>
        <Pressable onPress={pickMedia} style={styles.toolBtn}>
          <ImageIcon size={20} color={colors.text.secondary} />
        </Pressable>
        <Pressable style={styles.toolBtn}>
          <Hash size={20} color={colors.text.secondary} />
        </Pressable>
        <Pressable style={styles.toolBtn}>
          <AtSign size={20} color={colors.text.secondary} />
        </Pressable>
        <Pressable style={styles.toolBtn}>
          <Smile size={20} color={colors.text.secondary} />
        </Pressable>
        <Pressable style={styles.toolBtn}>
          <MapPin size={20} color={colors.text.secondary} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={styles.charCount}>{5000 - text.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 0.5, borderBottomColor: colors.hairline,
  },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.subtle, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.size.base, ...typography.weight.bold, color: colors.text.primary },
  publishBtn: { backgroundColor: colors.accent.DEFAULT, paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.full, minWidth: 64, alignItems: 'center' },
  publishBtnDisabled: { opacity: 0.5 },
  publishText: { color: '#fff', ...typography.size.sm, ...typography.weight.semibold },
  modesScroll: { borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  modesRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  modeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.bg.subtle, borderWidth: 1, borderColor: 'transparent' },
  modeChipActive: { borderColor: colors.accent.DEFAULT, backgroundColor: colors.accent.soft },
  modeIcon: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  modeLabel: { ...typography.size.sm, ...typography.weight.medium, color: colors.text.secondary },
  modeLabelActive: { color: colors.accent.DEFAULT, ...typography.weight.semibold },
  mediaWrap: { margin: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', position: 'relative' },
  media: { width: '100%', height: 280 },
  removeMedia: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 16 },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  uploadingText: { color: '#fff', ...typography.size.sm },
  input: { flex: 1, ...typography.size.lg, color: colors.text.primary, padding: spacing.lg, textAlignVertical: 'top' },
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.hairline, gap: spacing.md },
  toolBtn: { padding: 4 },
  charCount: { ...typography.size.xs, color: colors.text.tertiary },
});
