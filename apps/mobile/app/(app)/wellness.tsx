/**
 * Digital Wellness — usage stats, time limits, quiet hours
 */

import { useState } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Moon, Eye, EyeOff, Bell } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function Wellness() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['wellness', 'stats'],
    queryFn: () => api.getWellnessStats(),
  });
  const { data: settings } = useQuery({
    queryKey: ['wellness', 'settings'],
    queryFn: () => api.getWellnessSettings(),
  });

  const [dailyLimit, setDailyLimit] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const toggleSetting = async (key: string, value: boolean) => {
    setBusy(true);
    try {
      await api.updateWellnessSettings({ [key]: value });
      queryClient.invalidateQueries({ queryKey: ['wellness', 'settings'] });
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const saveDailyLimit = async () => {
    const mins = parseInt(dailyLimit, 10);
    if (isNaN(mins) || mins < 0) {
      Alert.alert('Invalid', 'Enter minutes (0 = no limit)');
      return;
    }
    setBusy(true);
    try {
      await api.updateWellnessSettings({ dailyMinutesLimit: mins });
      queryClient.invalidateQueries({ queryKey: ['wellness', 'settings'] });
      setDailyLimit('');
      Alert.alert('Saved', 'Daily time limit updated');
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const s: any = settings ?? {};

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Digital wellness</Text>
        <Text style={styles.subtitle}>You set the pace. ORBIT respects it.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today</Text>
        {statsLoading ? (
          <ActivityIndicator color={colors.accent.DEFAULT} />
        ) : (
          <View style={styles.statsRow}>
            {/* /wellness/usage returns {usedTodaySeconds, usedWeekSeconds, daily[]} */}
            <Stat
              label="Time used"
              value={`${Math.floor(((stats as any)?.usedTodaySeconds ?? 0) / 60)} min`}
            />
            <Stat
              label="Week total"
              value={`${Math.floor(((stats as any)?.usedWeekSeconds ?? 0) / 60)} min`}
            />
            <Stat label="Daily limit" value={s.dailyMinutesLimit ? `${s.dailyMinutesLimit} min` : 'Off'} />
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Time limits</Text>
        <View style={styles.row}>
          <Clock size={20} color={colors.text.secondary} />
          <Text style={styles.rowLabel}>Daily limit (minutes)</Text>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={dailyLimit}
            onChangeText={setDailyLimit}
            placeholder={s.dailyMinutesLimit ? `Currently ${s.dailyMinutesLimit}` : 'No limit'}
            placeholderTextColor={colors.text.tertiary}
            keyboardType="number-pad"
          />
          <Pressable
            style={[styles.saveButton, busy && styles.saveButtonBusy]}
            onPress={saveDailyLimit}
            disabled={busy}
          >
            <Text style={styles.saveButtonText}>Save</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Reduce addictive patterns</Text>
        <ToggleRow
          icon={<Moon size={20} color={colors.text.secondary} />}
          label="Hide like counts"
          value={!!s.hideLikesCount}
          onChange={(v) => toggleSetting('hideLikesCount', v)}
          disabled={busy}
        />
        <ToggleRow
          icon={<Eye size={20} color={colors.text.secondary} />}
          label="Show session timer"
          value={!!s.showTimer}
          onChange={(v) => toggleSetting('showTimer', v)}
          disabled={busy}
        />
        <ToggleRow
          icon={<Bell size={20} color={colors.text.secondary} />}
          label="Disable infinite scroll"
          value={!!s.noInfinitescroll}
          onChange={(v) => toggleSetting('noInfinitescroll', v)}
          disabled={busy}
        />
      </View>

      <Text style={styles.footer}>
        All data stays on your device unless you opt in to share anonymous trends.
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ToggleRow({ icon, label, value, onChange, disabled }: { icon: any; label: string; value: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLeft}>
        {icon}
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: colors.hairlineStrong, true: colors.accent.DEFAULT }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated, padding: spacing.xl, paddingTop: spacing.xxxl, gap: spacing.lg },
  header: { marginBottom: spacing.md },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { ...typography.size.sm, color: colors.text.secondary, marginTop: 2 },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  cardTitle: { ...typography.size.lg, ...typography.weight.bold, color: colors.text.primary },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { ...typography.size.xl, ...typography.weight.black, color: colors.accent.DEFAULT },
  statLabel: { ...typography.size.xs, color: colors.text.secondary, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { ...typography.size.base, color: colors.text.primary },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 16, color: colors.text.primary },
  saveButton: { backgroundColor: colors.accent.DEFAULT, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radius.md },
  saveButtonBusy: { opacity: 0.6 },
  saveButtonText: { color: colors.text.inverse, ...typography.weight.bold },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  toggleLabel: { ...typography.size.base, color: colors.text.primary },
  footer: { ...typography.size.xs, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
});
