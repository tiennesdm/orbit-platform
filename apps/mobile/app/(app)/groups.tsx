/**
 * Groups — list + create flow
 */

import { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Lock, Globe, Plus, X } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_GROUPS = [
  { id: 'g1', name: 'AI Builders India', slug: 'ai-builders-in', description: 'A community of AI engineers, researchers, and founders building in India.', memberCount: 2384, visibility: 'public', category: 'Tech', joined: true },
  { id: 'g2', name: 'Climate Tech', slug: 'climate-tech', description: 'For people working on climate solutions.', memberCount: 1432, visibility: 'public', category: 'Climate', joined: false },
  { id: 'g3', name: 'Indie Hackers', slug: 'indie-hackers', description: 'Building profitable products as solo founders or tiny teams.', memberCount: 3892, visibility: 'public', category: 'Business', joined: true },
];

export default function Groups() {
  const [composing, setComposing] = useState(false);

  if (composing) return <ComposeGroup onClose={() => setComposing(false)} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <Pressable onPress={() => setComposing(true)} style={styles.addBtn}>
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {MOCK_GROUPS.map((g) => (
          <View key={g.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{g.name[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{g.name}</Text>
                  {g.visibility === 'private' ? <Lock size={12} color={colors.text.tertiary} /> : <Globe size={12} color={colors.text.tertiary} />}
                </View>
                <Text style={styles.meta}>{g.memberCount.toLocaleString()} members · {g.category}</Text>
              </View>
            </View>
            <Text style={styles.desc}>{g.description}</Text>
            <View style={styles.actions}>
              <Pressable style={[styles.actionBtn, g.joined && styles.actionBtnJoined]}>
                <Text style={[styles.actionText, g.joined && styles.actionTextJoined]}>
                  {g.joined ? 'Joined' : 'Join'}
                </Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, styles.actionBtnGhost]}>
                <Text style={styles.actionText}>View</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function ComposeGroup({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Tech');
  const [visibility, setVisibility] = useState<'public' | 'private' | 'invite'>('public');

  const post = useMutation({
    mutationFn: () => api.createGroup({ name, description, category, visibility }),
    onSuccess: onClose,
    onError: (e: any) => Alert.alert('Failed', e.message),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.iconBtn}>
          <X size={20} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Create group</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }}>
        <TextInput value={name} onChangeText={setName} placeholder="Group name (e.g., AI Builders India)" placeholderTextColor={colors.text.tertiary} style={styles.input} />
        <TextInput value={description} onChangeText={setDescription} placeholder="What is this group about?" placeholderTextColor={colors.text.tertiary} multiline style={[styles.input, { minHeight: 100 }]} />
        <View>
          <Text style={styles.label}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['Tech', 'Climate', 'Business', 'Art', 'Music', 'Gaming', 'Other'].map((c) => (
              <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <Text style={styles.label}>Visibility</Text>
        {(['public', 'private', 'invite'] as const).map((v) => (
          <Pressable key={v} onPress={() => setVisibility(v)} style={[styles.radioRow, visibility === v && styles.radioRowActive]}>
            <View style={[styles.radio, visibility === v && styles.radioActive]}>
              {visibility === v && <View style={styles.radioDot} />}
            </View>
            <View>
              <Text style={styles.itemTitle}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
              <Text style={styles.itemSubtitle}>
                {v === 'public' && 'Anyone can find and join.'}
                {v === 'private' && 'Anyone can find, but join requires approval.'}
                {v === 'invite' && 'Hidden from search. Invite-only.'}
              </Text>
            </View>
          </Pressable>
        ))}
        <Pressable
          onPress={() => post.mutate()}
          disabled={!name || post.isPending}
          style={[styles.submitBtn, (!name || post.isPending) && { opacity: 0.5 }]}
        >
          <Text style={styles.submitText}>{post.isPending ? 'Creating…' : 'Create group'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.subtle, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.size.xl, ...typography.weight.bold, color: colors.text.primary, flex: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: 80 },
  card: { backgroundColor: colors.bg.subtle, borderRadius: radius.lg, padding: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', ...typography.weight.bold, fontSize: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { ...typography.size.base, ...typography.weight.bold, color: colors.text.primary },
  meta: { ...typography.size.xs, color: colors.text.tertiary, marginTop: 2 },
  desc: { ...typography.size.sm, color: colors.text.secondary, lineHeight: 20, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: { paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.accent.DEFAULT },
  actionBtnJoined: { backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.hairline },
  actionBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.hairline },
  actionText: { color: '#fff', ...typography.size.sm, ...typography.weight.semibold },
  actionTextJoined: { color: colors.text.secondary },
  input: { backgroundColor: colors.bg.subtle, borderRadius: radius.md, padding: spacing.md, ...typography.size.base, color: colors.text.primary, textAlignVertical: 'top' },
  label: { ...typography.size.sm, color: colors.text.tertiary, marginBottom: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg.subtle, marginRight: 6 },
  chipActive: { backgroundColor: colors.accent.DEFAULT },
  chipText: { ...typography.size.sm, color: colors.text.secondary },
  chipTextActive: { color: '#fff', ...typography.weight.semibold },
  radioRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg.subtle, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: 'transparent' },
  radioRowActive: { borderColor: colors.accent.DEFAULT },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.text.tertiary, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  radioActive: { borderColor: colors.accent.DEFAULT },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent.DEFAULT },
  itemTitle: { ...typography.size.base, ...typography.weight.semibold, color: colors.text.primary },
  itemSubtitle: { ...typography.size.sm, color: colors.text.tertiary, marginTop: 2 },
  submitBtn: { backgroundColor: colors.accent.DEFAULT, padding: spacing.md, borderRadius: radius.lg, alignItems: 'center' },
  submitText: { color: '#fff', ...typography.size.base, ...typography.weight.semibold },
});
