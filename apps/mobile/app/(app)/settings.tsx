/**
 * Settings — 6 sub-sections (Profile, AI Agent, Privacy, Safety, Notifications, Data)
 */

import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Pressable, Switch, StyleSheet, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, User, Bot, Shield, Eye, Bell, Key, Download, Trash2,
  AlertTriangle, ChevronRight, Globe,
} from 'lucide-react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

type Section = null | 'agent' | 'privacy' | 'safety' | 'notifications' | 'data';

export default function Settings() {
  const router = useRouter();
  const { logout } = useAuth();
  const [section, setSection] = useState<Section>(null);

  if (section) {
    return <SectionView section={section} onBack={() => setSection(null)} onLogout={logout} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        <SectionButton
          icon={<User size={18} color={colors.text.secondary} />}
          title="Profile"
          subtitle="Display name, handle, bio, avatar"
          onPress={() => router.push('/(app)/profile')}
        />
        <SectionButton
          icon={<Bot size={18} color={colors.accent.DEFAULT} />}
          title="AI Agent"
          subtitle="Autonomy · Personality"
          onPress={() => setSection('agent')}
        />
        <SectionButton
          icon={<Shield size={18} color={colors.success} />}
          title="Privacy"
          subtitle="Identity, blocked accounts, DMs"
          onPress={() => setSection('privacy')}
        />
        <SectionButton
          icon={<Eye size={18} color={colors.text.secondary} />}
          title="Safety & Anti-addiction"
          subtitle="Hide counts, no infinite scroll"
          onPress={() => setSection('safety')}
        />
        <SectionButton
          icon={<Bell size={18} color={colors.text.secondary} />}
          title="Notifications"
          subtitle="Push, email, digest"
          onPress={() => setSection('notifications')}
        />
        <SectionButton
          icon={<Key size={18} color={colors.text.secondary} />}
          title="Portable Identity"
          subtitle="DID, PDS provider"
          onPress={() => setSection('data')}
        />
        <SectionButton
          icon={<Download size={18} color={colors.text.secondary} />}
          title="Data & Privacy (GDPR)"
          subtitle="Export, download, delete"
          onPress={() => setSection('data')}
        />
        <Pressable style={[styles.item, styles.dangerItem]} onPress={() => logout()}>
          <View style={[styles.iconWrap, { backgroundColor: '#FEE2E2' }]}>
            <Trash2 size={18} color={colors.error} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemTitle, { color: colors.error }]}>Log out</Text>
            <Text style={styles.itemSubtitle}>Sign out of ORBIT on this device</Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionView({ section, onBack, onLogout }: { section: Section; onBack: () => void; onLogout: () => Promise<void> }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: agentState } = useQuery({
    queryKey: ['ai-agent', 'state'],
    queryFn: () => api.getAgentState() as any,
  });

  const updateAgent = useMutation({
    mutationFn: (updates: any) => api.updateAgentState(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-agent', 'state'] }),
  });

  const titles: Record<NonNullable<Section>, string> = {
    agent: 'AI Agent',
    privacy: 'Privacy',
    safety: 'Safety & Anti-addiction',
    notifications: 'Notifications',
    data: 'Data & Privacy',
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>{titles[section!]}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {section === 'agent' && (
          <>
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                Your AI agent lives in your DMs, surfaces relevant content, and helps you post. It only sees what you allow.
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Autonomy level</Text>
            {(['ask', 'suggest', 'auto'] as const).map((level) => (
              <Pressable
                key={level}
                onPress={() => updateAgent.mutate({ autonomyLevel: level })}
                style={[styles.radioRow, agentState?.autonomyLevel === level && styles.radioRowActive]}
              >
                <View style={[styles.radio, agentState?.autonomyLevel === level && styles.radioActive]}>
                  {agentState?.autonomyLevel === level && <View style={styles.radioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{level.charAt(0).toUpperCase() + level.slice(1)}</Text>
                  <Text style={styles.itemSubtitle}>
                    {level === 'ask' && 'Asks before any action.'}
                    {level === 'suggest' && 'Suggests actions, you confirm.'}
                    {level === 'auto' && 'Acts autonomously when asked.'}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Text style={styles.sectionTitle}>Personality</Text>
            {(['supportive', 'witty', 'professional', 'playful'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => updateAgent.mutate({ personality: p })}
                style={[styles.radioRow, agentState?.personality === p && styles.radioRowActive]}
              >
                <View style={[styles.radio, agentState?.personality === p && styles.radioActive]}>
                  {agentState?.personality === p && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.itemTitle}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
              </Pressable>
            ))}
            <Text style={styles.bannerText}>
              {agentState?.liveMode ? '🟢 Live — connected to Claude' : '🟡 Echo mode — set ANTHROPIC_API_KEY for real responses'}
            </Text>
          </>
        )}

        {section === 'privacy' && (
          <>
            <Toggle label="Allow DMs from non-followers" />
            <Toggle label="Show online status" defaultValue />
            <Toggle label="Allow search engines to index my profile" />
            <Toggle label="Read receipts in DMs" defaultValue />
            <Toggle label="Show my follow list" defaultValue />
            <Toggle label="Discoverable in search" defaultValue />
          </>
        )}

        {section === 'safety' && (
          <>
            <View style={[styles.banner, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[styles.bannerText, { color: '#15803D' }]}>
                ✓ ORBIT uses chronological feeds by default. No infinite scroll. No algorithm.
              </Text>
            </View>
            <Toggle label="Hide like counts from my posts" />
            <Toggle label="Hide follower counts on my profile" />
            <Toggle label="Daily usage limit (30 min)" />
            <Toggle label="Show usage stats" defaultValue />
            <Toggle label="Block screenshots of my posts" />
            <Toggle label="Mute notifications after 9pm" />
          </>
        )}

        {section === 'notifications' && (
          <>
            <Toggle label="Push notifications" defaultValue />
            <Toggle label="Email digest (daily)" defaultValue />
            <Toggle label="Mentions" defaultValue />
            <Toggle label="Likes" defaultValue />
            <Toggle label="New followers" defaultValue />
            <Toggle label="Replies" defaultValue />
            <Toggle label="AI digest" defaultValue />
          </>
        )}

        {section === 'data' && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Globe size={20} color={colors.accent.DEFAULT} />
                <Text style={styles.cardTitle}>Portable Identity (DID)</Text>
              </View>
              <Text style={styles.cardText}>
                Your identity is portable. Take it to any PDS provider, or self-host.
              </Text>
              <Pressable style={styles.cardAction}>
                <Text style={styles.cardActionText}>View DID document</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Download size={20} color={colors.accent.DEFAULT} />
                <Text style={styles.cardTitle}>Export your data</Text>
              </View>
              <Text style={styles.cardText}>
                Download everything in a portable JSON archive. Includes posts, DMs (decrypted), follows, AI memory.
              </Text>
              <Pressable
                style={styles.cardAction}
                onPress={() => Alert.alert('Export queued', 'You will receive a download link via email within 24 hours.')}
              >
                <Text style={styles.cardActionText}>Request data export</Text>
              </Pressable>
            </View>

            <View style={[styles.card, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <View style={styles.cardHeader}>
                <AlertTriangle size={20} color={colors.error} />
                <Text style={[styles.cardTitle, { color: colors.error }]}>Delete account</Text>
              </View>
              <Text style={[styles.cardText, { color: '#991B1B' }]}>
                Soft-delete with 30-day grace. Cancel by logging in again. After 30 days, all data is permanently removed.
              </Text>
              <Pressable
                style={[styles.cardAction, { backgroundColor: colors.error }]}
                onPress={() => Alert.alert(
                  'Delete account?',
                  'This will soft-delete your account with a 30-day grace period. Continue?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await api.deleteAccount();
                          await onLogout();
                          router.replace('/(onboarding)');
                        } catch (e: any) {
                          Alert.alert('Error', e.message || 'Failed to delete');
                        }
                      },
                    },
                  ],
                )}
              >
                <Text style={[styles.cardActionText, { color: '#fff' }]}>Request account deletion</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionButton({ icon, title, subtitle, onPress }: { icon: React.ReactNode; title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitle}>{title}</Text>
        <Text style={styles.itemSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={colors.text.tertiary} />
    </Pressable>
  );
}

function Toggle({ label, defaultValue }: { label: string; defaultValue?: boolean }) {
  const [on, setOn] = useState(!!defaultValue);
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.itemTitle}>{label}</Text>
      <Switch
        value={on}
        onValueChange={setOn}
        trackColor={{ false: colors.bg.subtle, true: colors.accent.DEFAULT }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.subtle, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.size.xl, ...typography.weight.bold, color: colors.text.primary, flex: 1 },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xxxl },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg.subtle, borderRadius: radius.lg },
  dangerItem: { backgroundColor: '#FEE2E2' },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  itemTitle: { ...typography.size.base, ...typography.weight.semibold, color: colors.text.primary },
  itemSubtitle: { ...typography.size.sm, color: colors.text.tertiary, marginTop: 2 },
  banner: { backgroundColor: colors.accent.soft, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.md },
  bannerText: { ...typography.size.sm, color: colors.accent.DEFAULT, lineHeight: 20 },
  sectionTitle: { ...typography.size.lg, ...typography.weight.bold, color: colors.text.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.bg.subtle, borderRadius: radius.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: 'transparent' },
  radioRowActive: { borderColor: colors.accent.DEFAULT, backgroundColor: colors.accent.soft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.text.tertiary, justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: colors.accent.DEFAULT },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent.DEFAULT },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.bg.subtle, borderRadius: radius.lg, marginBottom: spacing.sm },
  card: { backgroundColor: colors.bg.subtle, padding: spacing.md, borderRadius: radius.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.hairline },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardTitle: { ...typography.size.base, ...typography.weight.semibold, color: colors.text.primary },
  cardText: { ...typography.size.sm, color: colors.text.secondary, lineHeight: 20, marginBottom: spacing.md },
  cardAction: { backgroundColor: colors.accent.DEFAULT, padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  cardActionText: { color: '#fff', ...typography.size.sm, ...typography.weight.semibold },
});
