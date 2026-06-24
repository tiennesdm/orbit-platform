/**
 * Custom Feeds — build your own algorithm
 */

import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2 } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

type RuleType = 'mode' | 'hashtag' | 'author' | 'min_likes' | 'no_replies' | 'lang' | 'media' | 'engagement';

const RULE_TYPES: { id: RuleType; label: string }[] = [
  { id: 'mode', label: 'Mode' },
  { id: 'hashtag', label: 'Hashtag' },
  { id: 'author', label: 'Author' },
  { id: 'min_likes', label: 'Min likes' },
  { id: 'no_replies', label: 'No replies' },
  { id: 'lang', label: 'Language' },
  { id: 'media', label: 'Has media' },
  { id: 'engagement', label: 'High engagement' },
];

export default function Feeds() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['feeds', 'custom'],
    queryFn: () => api.listCustomFeeds(),
  });
  const [showCreate, setShowCreate] = useState(false);
  // /feeds/mine returns a plain array; handle both shapes defensively
  const feeds: any[] = Array.isArray(data) ? data : (data as any)?.feeds ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Your feeds</Text>
          <Text style={styles.subtitle}>Build the algorithm you want</Text>
        </View>
        <Pressable style={styles.createButton} onPress={() => setShowCreate(true)}>
          <Plus size={20} color={colors.text.inverse} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.accent.DEFAULT} /></View>
      ) : feeds.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎛️</Text>
          <Text style={styles.emptyTitle}>No custom feeds yet</Text>
          <Text style={styles.emptyText}>Build one to control what shows up in your home timeline</Text>
        </View>
      ) : (
        <FlatList
          data={feeds}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => (
            <FeedCard
              feed={item}
              onDelete={async () => {
                try {
                  await api.deleteCustomFeed(item.id);
                  queryClient.invalidateQueries({ queryKey: ['feeds', 'custom'] });
                } catch (e: any) {
                  Alert.alert('Delete failed', e?.message ?? 'Try again');
                }
              }}
            />
          )}
          contentContainerStyle={styles.list}
        />
      )}

      {showCreate && (
        <CreateFeedModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['feeds', 'custom'] });
          }}
        />
      )}
    </View>
  );
}

function FeedCard({ feed, onDelete }: { feed: any; onDelete: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.emoji}>{feed.emoji || '🎛️'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{feed.name}</Text>
          <Text style={styles.cardMeta}>{(feed.rules?.length ?? 0)} rules</Text>
        </View>
        <Pressable onPress={onDelete} style={styles.deleteButton}>
          <Trash2 size={18} color={colors.danger} />
        </Pressable>
      </View>
      {feed.rules?.map((r: any, i: number) => (
        <Text key={i} style={styles.ruleText}>
          {r.type}: {r.value}
        </Text>
      ))}
    </View>
  );
}

function CreateFeedModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🎛️');
  const [rules, setRules] = useState<Array<{ type: RuleType; value: string }>>([]);
  const [selectedType, setSelectedType] = useState<RuleType>('mode');
  const [ruleValue, setRuleValue] = useState('');
  const [busy, setBusy] = useState(false);

  const addRule = () => {
    if (!ruleValue.trim()) return;
    setRules([...rules, { type: selectedType, value: ruleValue.trim() }]);
    setRuleValue('');
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Add a name');
      return;
    }
    if (rules.length === 0) {
      Alert.alert('Add at least one rule');
      return;
    }
    setBusy(true);
    try {
      await api.createCustomFeed({ name: name.trim(), emoji, rules });
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
          <Text style={styles.modalTitle}>New custom feed</Text>
          <Pressable onPress={onClose}><X size={22} color={colors.text.secondary} /></Pressable>
        </View>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Feed name (e.g. Tech intros)"
          placeholderTextColor={colors.text.tertiary}
        />
        <TextInput
          style={styles.input}
          value={emoji}
          onChangeText={setEmoji}
          placeholder="🎛️"
          placeholderTextColor={colors.text.tertiary}
        />
        <Text style={styles.label}>Rules</Text>
        {rules.map((r, i) => (
          <View key={i} style={styles.ruleChip}>
            <Text style={styles.ruleChipText}>{r.type}: {r.value}</Text>
            <Pressable onPress={() => setRules(rules.filter((_, idx) => idx !== i))}>
              <X size={14} color={colors.text.secondary} />
            </Pressable>
          </View>
        ))}
        <View style={styles.ruleAddRow}>
          <View style={styles.typeRow}>
            {RULE_TYPES.slice(0, 4).map((rt) => (
              <Pressable
                key={rt.id}
                style={[styles.typeChip, selectedType === rt.id && styles.typeChipActive]}
                onPress={() => setSelectedType(rt.id)}
              >
                <Text style={[styles.typeChipText, selectedType === rt.id && styles.typeChipTextActive]}>
                  {rt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.typeRow}>
            {RULE_TYPES.slice(4).map((rt) => (
              <Pressable
                key={rt.id}
                style={[styles.typeChip, selectedType === rt.id && styles.typeChipActive]}
                onPress={() => setSelectedType(rt.id)}
              >
                <Text style={[styles.typeChipText, selectedType === rt.id && styles.typeChipTextActive]}>
                  {rt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.valueRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={ruleValue}
              onChangeText={setRuleValue}
              placeholder="Value"
              placeholderTextColor={colors.text.tertiary}
            />
            <Pressable onPress={addRule} style={styles.addRuleButton}>
              <Text style={styles.addRuleButtonText}>+ Add</Text>
            </Pressable>
          </View>
        </View>
        <Pressable
          style={[styles.createConfirm, busy && styles.createConfirmBusy]}
          onPress={onSave}
          disabled={busy}
        >
          <Text style={styles.createConfirmText}>{busy ? 'Saving…' : 'Create feed'}</Text>
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
  card: { backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  emoji: { fontSize: 32 },
  cardTitle: { ...typography.size.lg, ...typography.weight.bold, color: colors.text.primary },
  cardMeta: { ...typography.size.xs, color: colors.text.secondary },
  deleteButton: { padding: spacing.sm },
  ruleText: { ...typography.size.sm, color: colors.text.secondary, fontFamily: typography.fontFamily.mono },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg.elevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.sm, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { ...typography.size.xl, ...typography.weight.black, color: colors.text.primary },
  input: { backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16, color: colors.text.primary },
  label: { ...typography.weight.semibold, ...typography.size.sm, color: colors.text.secondary, marginTop: spacing.md },
  ruleChip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.accent.soft, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
  ruleChipText: { ...typography.size.sm, color: colors.accent.DEFAULT, ...typography.weight.semibold },
  ruleAddRow: { gap: spacing.sm },
  typeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  typeChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.xs, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.hairlineStrong },
  typeChipActive: { backgroundColor: colors.accent.soft, borderColor: colors.accent.DEFAULT },
  typeChipText: { ...typography.size.xs, color: colors.text.secondary },
  typeChipTextActive: { color: colors.accent.DEFAULT, ...typography.weight.bold },
  valueRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  addRuleButton: { backgroundColor: colors.accent.soft, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radius.md },
  addRuleButtonText: { color: colors.accent.DEFAULT, ...typography.weight.bold },
  createConfirm: { backgroundColor: colors.accent.DEFAULT, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
  createConfirmBusy: { opacity: 0.6 },
  createConfirmText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
});
