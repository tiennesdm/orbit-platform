/**
 * Inbox — DM threads list + tap to open thread
 */

import { useState } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Send, Lock, ArrowLeft, Plus, Sparkles } from 'lucide-react-native';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_THREADS = [
  { id: 't1', handle: 'alice', displayName: 'Alice', lastMessage: 'See you tomorrow!', lastAt: Date.now() - 300_000, unread: 2 },
  { id: 't2', handle: 'bob', displayName: 'Bob', lastMessage: 'Sounds good 🚀', lastAt: Date.now() - 3_600_000, unread: 0 },
  { id: 't3', handle: 'carol', displayName: 'Carol', lastMessage: 'Coffee at 3?', lastAt: Date.now() - 86_400_000, unread: 0 },
];

const MOCK_MESSAGES = [
  { id: 'm1', senderDid: 'did:orbit:alice', content: 'Hey! Welcome to ORBIT 🎉', at: Date.now() - 3_600_000, encrypted: true },
  { id: 'm2', senderDid: 'me', content: 'Thanks! Excited to be here.', at: Date.now() - 3_500_000, encrypted: true },
  { id: 'm3', senderDid: 'did:orbit:alice', content: 'The 4-mode compose is genius. Intimate for friends, public for everyone.', at: Date.now() - 3_400_000, encrypted: true },
];

export default function Inbox() {
  return <InboxList />;
}

function InboxList() {
  const router = useRouter();
  const [threads] = useState(MOCK_THREADS);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Pressable style={styles.iconBtn}>
          <Plus size={20} color={colors.text.primary} />
        </Pressable>
      </View>
      <FlatList
        data={threads}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => (
          <Pressable
            style={styles.thread}
            onPress={() => router.push({ pathname: '/(app)/inbox/thread', params: { threadId: item.id } })}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.displayName[0]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.threadHeader}>
                <Text style={styles.displayName}>{item.displayName}</Text>
                <Text style={styles.timeAgo}>{timeAgo(item.lastAt)}</Text>
              </View>
              <View style={styles.lastMsgRow}>
                <Lock size={10} color={colors.success} />
                <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
                {item.unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread}</Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

export function ThreadView({ threadId }: { threadId: string }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [draft, setDraft] = useState('');

  const send = useMutation({
    mutationFn: (content: string) => api.sendMessage(threadId, content, true),
    onSuccess: (_, content) => {
      setMessages((prev) => [...prev, {
        id: `tmp_${Date.now()}`,
        senderDid: 'me',
        content,
        at: Date.now(),
        encrypted: true,
      }]);
    },
  });

  function submit() {
    if (!draft.trim()) return;
    send.mutate(draft);
    setDraft('');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.text.primary} />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.displayName}>@alice</Text>
          <View style={styles.encryptedRow}>
            <Lock size={10} color={colors.success} />
            <Text style={styles.encryptedText}>End-to-end encrypted</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.threadList}
        renderItem={({ item }) => {
          const isMe = item.senderDid === 'me';
          return (
            <View style={[styles.bubbleRow, isMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, isMe && { color: '#fff' }]}>{item.content}</Text>
                <View style={styles.bubbleMeta}>
                  {item.encrypted && <Lock size={9} color={isMe ? 'rgba(255,255,255,0.7)' : colors.text.tertiary} />}
                  <Text style={[styles.bubbleTime, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
                    {timeAgo(item.at)}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message…"
            placeholderTextColor={colors.text.tertiary}
            style={styles.composerInput}
            onSubmitEditing={submit}
            returnKeyType="send"
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim() || send.isPending}
            style={[styles.sendBtn, !draft.trim() && { opacity: 0.5 }]}
          >
            {send.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
          </Pressable>
        </View>
        <View style={styles.encryptedFooter}>
          <Lock size={10} color={colors.success} />
          <Text style={styles.encryptedFooterText}>Messages are end-to-end encrypted with the Signal Protocol</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function timeAgo(ts: number): string {
  const ms = Date.now() - ts;
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.subtle, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, letterSpacing: -0.5, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', ...typography.weight.bold, fontSize: 14 },
  thread: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  threadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  displayName: { ...typography.weight.semibold, color: colors.text.primary, fontSize: 16 },
  timeAgo: { ...typography.size.xs, color: colors.text.tertiary },
  lastMsgRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  lastMessage: { flex: 1, ...typography.size.sm, color: colors.text.secondary },
  badge: { backgroundColor: colors.accent.DEFAULT, borderRadius: 10, paddingHorizontal: 6, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 11, ...typography.weight.bold },
  separator: { height: 0.5, backgroundColor: colors.hairline, marginLeft: 60 },
  encryptedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  encryptedText: { ...typography.size.xs, color: colors.text.tertiary },
  threadList: { padding: spacing.lg, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '75%', borderRadius: 18, padding: spacing.md },
  bubbleMe: { backgroundColor: colors.accent.DEFAULT, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: colors.bg.subtle, borderBottomLeftRadius: 4 },
  bubbleText: { ...typography.size.base, color: colors.text.primary, lineHeight: 20 },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  bubbleTime: { ...typography.size.xs, color: colors.text.tertiary },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.hairline },
  composerInput: { flex: 1, backgroundColor: colors.bg.subtle, borderRadius: 20, paddingHorizontal: spacing.lg, paddingVertical: 10, ...typography.size.base, color: colors.text.primary },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  encryptedFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center', paddingBottom: spacing.sm },
  encryptedFooterText: { ...typography.size.xs, color: colors.text.tertiary },
});
