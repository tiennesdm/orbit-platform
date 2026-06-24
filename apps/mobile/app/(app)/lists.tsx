/**
 * Lists — organize people into custom groups
 */

import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Users } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

const KINDS = [
  { id: 'close_friends', label: 'Close friends' },
  { id: 'muted', label: 'Muted' },
  { id: 'family', label: 'Family' },
  { id: 'work', label: 'Work' },
];

export default function Lists() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['lists'],
    queryFn: () => api.listUserLists(),
  });
  const [showCreate, setShowCreate] = useState(false);
  const lists = (data as any)?.lists ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Lists</Text>
          <Text style={styles.subtitle}>Organize the people you follow</Text>
        </View>
        <Pressable style={styles.createButton} onPress={() => setShowCreate(true)}>
          <Plus size={20} color={colors.text.inverse} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent.DEFAULT} /></View>
      ) : lists.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>No lists yet</Text>
          <Text style={styles.emptyText}>Group people into Close friends, Muted, or custom lists</Text>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.emoji}>{item.emoji || '📋'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardMeta}>
                    {item.kind} · {item.memberCount ?? 0} members
                  </Text>
                </View>
              </View>
              {item.description && <Text style={styles.cardDescription}>{item.description}</Text>}
            </View>
          )}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      )}

      {showCreate && (
        <CreateListModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['lists'] });
          }}
        />
      )}
    </View>
  );
}

function CreateListModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📋');
  const [kind, setKind] = useState('close_friends');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Add a name');
      return;
    }
    setBusy(true);
    try {
      await api.createList({ name: name.trim(), kind, emoji, description: description.trim() || undefined });
      onCreated();
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New list</Text>
          <Pressable onPress={onClose}><X size={22} color={colors.text.secondary} /></Pressable>
        </View>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={emoji}
            onChangeText={setEmoji}
            placeholder="📋"
            placeholderTextColor={colors.text.tertiary}
          />
          <TextInput
            style={[styles.input, { flex: 4 }]}
            value={name}
            onChangeText={setName}
            placeholder="List name"
            placeholderTextColor={colors.text.tertiary}
          />
        </View>
        <Text style={styles.label}>Kind</Text>
        <View style={styles.kindRow}>
          {KINDS.map((k) => (
            <Pressable
              key={k.id}
              style={[styles.kindChip, kind === k.id && styles.kindChipActive]}
              onPress={() => setKind(k.id)}
            >
              <Text style={[styles.kindChipText, kind === k.id && styles.kindChipTextActive]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Description (optional)"
          placeholderTextColor={colors.text.tertiary}
        />
        <Pressable
          style={[styles.createConfirm, busy && styles.createConfirmBusy]}
          onPress={onCreate}
          disabled={busy}
        >
          <Text style={styles.createConfirmText}>{busy ? 'Creating…' : 'Create list'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, paddingTop: spacing.xxxl },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { ...typography.size.sm, color: colors.text.secondary, marginTop: 2 },
  createButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { ...typography.size.xl, ...typography.weight.bold, color: colors.text.primary, marginBottom: spacing.sm },
  emptyText: { ...typography.size.base, color: colors.text.secondary, textAlign: 'center' },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 32 },
  cardTitle: { ...typography.size.lg, ...typography.weight.bold, color: colors.text.primary },
  cardMeta: { ...typography.size.xs, color: colors.text.secondary, textTransform: 'capitalize' },
  cardDescription: { ...typography.size.sm, color: colors.text.secondary, lineHeight: 18 },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg.elevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...typography.size.xl, ...typography.weight.black, color: colors.text.primary },
  row: { flexDirection: 'row', gap: spacing.sm },
  input: { backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16, color: colors.text.primary },
  label: { ...typography.weight.semibold, ...typography.size.sm, color: colors.text.secondary, marginTop: spacing.sm },
  kindRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  kindChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.hairlineStrong },
  kindChipActive: { backgroundColor: colors.accent.soft, borderColor: colors.accent.DEFAULT },
  kindChipText: { ...typography.size.sm, color: colors.text.secondary, ...typography.weight.semibold },
  kindChipTextActive: { color: colors.accent.DEFAULT },
  createConfirm: { backgroundColor: colors.accent.DEFAULT, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
  createConfirmBusy: { opacity: 0.6 },
  createConfirmText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
});
