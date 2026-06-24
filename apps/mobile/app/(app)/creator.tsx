/**
 * Creator — earnings dashboard for paid subscriptions and tips
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert, TextInput } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, Users, TrendingUp, Plus, X } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function Creator() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['creator', 'earnings'],
    queryFn: () => api.getCreatorEarnings(),
  });
  const { data: tiers } = useQuery({
    queryKey: ['monetization', 'tiers', 'me'],
    queryFn: () => api.getCreatorTiers('me'),
  });
  const [showCreate, setShowCreate] = useState(false);

  const e: any = data ?? {};
  const tierList: any[] = (tiers as any)?.tiers ?? [];

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent.DEFAULT} size="large" />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>💰</Text>
        <Text style={styles.emptyTitle}>Couldn't load earnings</Text>
        <Text style={styles.emptyText}>{error instanceof Error ? error.message : 'Try again'}</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Creator</Text>
          <Text style={styles.subtitle}>Your work has value</Text>
        </View>
        <Pressable style={styles.createButton} onPress={() => setShowCreate(true)}>
          <Plus size={20} color={colors.text.inverse} />
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon={<DollarSign size={24} color="#10B981" />}
          label="This month"
          value={`$${((e.monthlyCents ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard
          icon={<TrendingUp size={24} color={colors.accent.DEFAULT} />}
          label="All-time"
          value={`$${((e.totalCents ?? 0) / 100).toFixed(2)}`}
        />
        <StatCard
          icon={<Users size={24} color="#F472B6" />}
          label="Subscribers"
          value={`${e.subscriberCount ?? 0}`}
        />
        <StatCard
          icon={<DollarSign size={24} color="#A78BFA" />}
          label="Tips"
          value={`$${((e.tipCents ?? 0) / 100).toFixed(2)}`}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your tiers</Text>
        {tierList.length === 0 ? (
          <Text style={styles.emptyText}>No tiers yet. Create one to start earning.</Text>
        ) : (
          tierList.map((t) => (
            <View key={t.id} style={styles.tierRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.tierName}>{t.name}</Text>
                <Text style={styles.tierMeta}>{t.subscriberCount ?? 0} subscribers</Text>
              </View>
              <Text style={styles.tierPrice}>${(t.priceCents / 100).toFixed(2)}/mo</Text>
            </View>
          ))
        )}
      </View>

      {showCreate && (
        <CreateTierModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}
    </ScrollView>
  );
}

function StatCard({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CreateTierModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [perks, setPerks] = useState('');
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!name.trim() || isNaN(priceCents) || priceCents <= 0) {
      Alert.alert('Add a name and valid price');
      return;
    }
    setBusy(true);
    try {
      await api.createTier({
        name: name.trim(),
        priceCents,
        perks: perks.split(',').map((p) => p.trim()).filter(Boolean),
      });
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
          <Text style={styles.modalTitle}>New tier</Text>
          <Pressable onPress={onClose}><X size={22} color={colors.text.secondary} /></Pressable>
        </View>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Tier name (e.g. Supporter)"
          placeholderTextColor={colors.text.tertiary}
        />
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          placeholder="Price (USD/month, e.g. 5.00)"
          placeholderTextColor={colors.text.tertiary}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={styles.input}
          value={perks}
          onChangeText={setPerks}
          placeholder="Perks (comma-separated, optional)"
          placeholderTextColor={colors.text.tertiary}
        />
        <Pressable
          style={[styles.createConfirm, busy && styles.createConfirmBusy]}
          onPress={onCreate}
          disabled={busy}
        >
          <Text style={styles.createConfirmText}>{busy ? 'Creating…' : 'Create tier'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  content: { padding: spacing.xl, paddingTop: spacing.xxxl, gap: spacing.lg, paddingBottom: spacing.xxxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.elevated, padding: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { ...typography.size.sm, color: colors.text.secondary, marginTop: 2 },
  createButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  statCard: { width: '47%', backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs },
  statValue: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, marginTop: spacing.xs },
  statLabel: { ...typography.size.xs, color: colors.text.secondary },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  cardTitle: { ...typography.size.lg, ...typography.weight.bold, color: colors.text.primary },
  emptyText: { ...typography.size.base, color: colors.text.secondary },
  tierRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairlineStrong },
  tierName: { ...typography.size.base, ...typography.weight.semibold, color: colors.text.primary },
  tierMeta: { ...typography.size.xs, color: colors.text.secondary, marginTop: 2 },
  tierPrice: { ...typography.size.base, ...typography.weight.bold, color: '#10B981' },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { ...typography.size.xl, ...typography.weight.bold, color: colors.text.primary, marginBottom: spacing.sm },
  retryButton: { marginTop: spacing.lg, backgroundColor: colors.accent.DEFAULT, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  retryButtonText: { color: colors.text.inverse, ...typography.weight.bold },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg.elevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...typography.size.xl, ...typography.weight.black, color: colors.text.primary },
  input: { backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16, color: colors.text.primary },
  createConfirm: { backgroundColor: colors.accent.DEFAULT, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
  createConfirmBusy: { opacity: 0.6 },
  createConfirmText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
});
