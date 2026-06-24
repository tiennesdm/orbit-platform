/**
 * Drafts — scheduled and unsent posts
 */

import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Calendar, Trash2 } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function Drafts() {
  const queryClient = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['drafts'],
    queryFn: () => api.listDrafts(),
  });
  const [showCreate, setShowCreate] = useState(false);
  const drafts = (data as any)?.drafts ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Drafts</Text>
          <Text style={styles.subtitle}>Save ideas. Schedule them for later.</Text>
        </View>
        <Pressable style={styles.createButton} onPress={() => setShowCreate(true)}>
          <Plus size={20} color={colors.text.inverse} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent.DEFAULT} /></View>
      ) : drafts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyTitle}>No drafts</Text>
          <Text style={styles.emptyText}>Start writing — your work saves here automatically</Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => (
            <DraftCard
              draft={item}
              onDelete={async () => {
                try {
                  await api.deleteDraft(item.id);
                  queryClient.invalidateQueries({ queryKey: ['drafts'] });
                } catch (e: any) {
                  Alert.alert('Delete failed', e?.message ?? 'Try again');
                }
              }}
            />
          )}
          contentContainerStyle={styles.list}
          refreshing={isRefetching}
          onRefresh={refetch}
        />
      )}

      {showCreate && (
        <CreateDraftModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['drafts'] });
          }}
        />
      )}
    </View>
  );
}

function DraftCard({ draft, onDelete }: { draft: any; onDelete: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.modePill}>
          <Text style={styles.modePillText}>{draft.mode || 'public'}</Text>
        </View>
        {draft.scheduledAt && (
          <View style={styles.scheduledPill}>
            <Calendar size={12} color={colors.accent.DEFAULT} />
            <Text style={styles.scheduledText}>{new Date(draft.scheduledAt).toLocaleDateString()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Trash2 size={18} color={colors.danger} />
        </Pressable>
      </View>
      <Text style={styles.content} numberOfLines={4}>
        {draft.contentText}
      </Text>
      <Text style={styles.timestamp}>
        Updated {new Date(draft.updatedAt || draft.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );
}

function CreateDraftModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    if (!content.trim()) {
      Alert.alert('Add some content');
      return;
    }
    setBusy(true);
    try {
      await api.saveDraft({ mode: 'public', contentText: content.trim() });
      onCreated();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message ?? 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>New draft</Text>
          <Pressable onPress={onClose}><X size={22} color={colors.text.secondary} /></Pressable>
        </View>
        <TextInput
          style={styles.input}
          value={content}
          onChangeText={setContent}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.text.tertiary}
          multiline
          autoFocus
        />
        <Pressable
          style={[styles.createConfirm, busy && styles.createConfirmBusy]}
          onPress={onSave}
          disabled={busy}
        >
          <Text style={styles.createConfirmText}>{busy ? 'Saving…' : 'Save draft'}</Text>
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modePill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.xs, backgroundColor: colors.accent.soft },
  modePillText: { ...typography.size.xs, ...typography.weight.bold, color: colors.accent.DEFAULT, textTransform: 'uppercase' },
  scheduledPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.xs, backgroundColor: colors.accent.soft },
  scheduledText: { ...typography.size.xs, color: colors.accent.DEFAULT, ...typography.weight.semibold },
  deleteButton: { padding: spacing.sm },
  content: { ...typography.size.base, color: colors.text.primary, lineHeight: 22 },
  timestamp: { ...typography.size.xs, color: colors.text.tertiary },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg.elevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...typography.size.xl, ...typography.weight.black, color: colors.text.primary },
  input: { backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16, color: colors.text.primary, minHeight: 120, textAlignVertical: 'top' },
  createConfirm: { backgroundColor: colors.accent.DEFAULT, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center' },
  createConfirmBusy: { opacity: 0.6 },
  createConfirmText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
});
