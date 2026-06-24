/**
 * Voice rooms — list + active room with WebRTC signaling
 */

import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, MicOff, Hand, Plus, X } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

const MODES = ['public', 'intimate', 'visual', 'community'] as const;

export default function VoiceRooms() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading, refetch, isRefetching, isError, error } = useQuery({
    queryKey: ['voice', 'rooms'],
    queryFn: () => api.listVoiceRooms(),
  });
  const rooms = (data as any)?.rooms ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Voice rooms</Text>
          <Text style={styles.subtitle}>Drop in. Talk it out.</Text>
        </View>
        <Pressable style={styles.createButton} onPress={() => setShowCreate(true)}>
          <Plus size={20} color={colors.text.inverse} />
        </Pressable>
      </View>

      {isError ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎙️</Text>
          <Text style={styles.emptyTitle}>Couldn't load rooms</Text>
          <Text style={styles.emptyText}>{error instanceof Error ? error.message : 'Try again later'}</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()}>
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      ) : rooms.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎙️</Text>
          <Text style={styles.emptyTitle}>No live rooms</Text>
          <Text style={styles.emptyText}>Be the first to start one</Text>
        </View>
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: any) => <RoomCard room={item} onJoin={() => queryClient.invalidateQueries({ queryKey: ['voice', 'rooms'] })} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent.DEFAULT} />}
        />
      )}

      {showCreate && (
        <CreateRoomModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            refetch();
          }}
        />
      )}
    </View>
  );
}

function RoomCard({ room, onJoin }: { room: any; onJoin: () => void }) {
  const [joining, setJoining] = useState(false);
  const handleJoin = async () => {
    setJoining(true);
    try {
      await api.joinVoiceRoom(room.id);
      onJoin();
      Alert.alert('Joined', `You're in "${room.title}"`);
    } catch (e: any) {
      Alert.alert('Failed to join', e?.message ?? 'Try again');
    } finally {
      setJoining(false);
    }
  };
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.modePill, { backgroundColor: modeColor(room.mode) + '22' }]}>
          <Text style={[styles.modePillText, { color: modeColor(room.mode) }]}>{room.mode}</Text>
        </View>
        <Text style={styles.liveText}>● {room.participantCount ?? 0} live</Text>
      </View>
      <Text style={styles.roomTitle}>{room.title}</Text>
      <Text style={styles.roomHost}>hosted by @{room.hostHandle}</Text>
      <Pressable
        style={[styles.joinButton, joining && styles.joinButtonBusy]}
        onPress={handleJoin}
        disabled={joining}
      >
        <Mic size={16} color={colors.text.inverse} />
        <Text style={styles.joinButtonText}>{joining ? 'Joining…' : 'Join'}</Text>
      </Pressable>
    </View>
  );
}

function CreateRoomModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<typeof MODES[number]>('public');
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Add a title', 'What\'s the room about?');
      return;
    }
    setBusy(true);
    try {
      await api.createVoiceRoom({ title: title.trim(), mode, isPublic: true });
      onCreated();
    } catch (e: any) {
      Alert.alert('Failed to create', e?.message ?? 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Start a voice room</Text>
          <Pressable onPress={onClose}><X size={22} color={colors.text.secondary} /></Pressable>
        </View>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What's the room about?"
          placeholderTextColor={colors.text.tertiary}
        />
        <Text style={styles.label}>Mode</Text>
        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <Pressable
              key={m}
              style={[styles.modeOption, mode === m && styles.modeOptionActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeOptionText, mode === m && styles.modeOptionTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.createConfirm, busy && styles.createConfirmBusy]}
          onPress={onCreate}
          disabled={busy}
        >
          <Text style={styles.createConfirmText}>{busy ? 'Starting…' : 'Go live'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function modeColor(mode: string): string {
  return mode === 'intimate' ? '#A78BFA' : mode === 'visual' ? '#F472B6' : mode === 'community' ? '#34D399' : '#60A5FA';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.xl, paddingTop: spacing.xxxl,
  },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { ...typography.size.sm, color: colors.text.secondary, marginTop: 2 },
  createButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent.DEFAULT,
    justifyContent: 'center', alignItems: 'center',
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { ...typography.size.xl, ...typography.weight.bold, color: colors.text.primary, marginBottom: spacing.sm },
  emptyText: { ...typography.size.base, color: colors.text.secondary, textAlign: 'center' },
  list: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modePill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.xs },
  modePillText: { ...typography.size.xs, ...typography.weight.bold, textTransform: 'uppercase' },
  liveText: { ...typography.size.xs, color: '#EF4444', ...typography.weight.bold },
  roomTitle: { ...typography.size.lg, ...typography.weight.bold, color: colors.text.primary },
  roomHost: { ...typography.size.sm, color: colors.text.secondary },
  joinButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.accent.DEFAULT, paddingVertical: spacing.md, borderRadius: radius.md, marginTop: spacing.sm,
  },
  joinButtonBusy: { opacity: 0.6 },
  joinButtonText: { color: colors.text.inverse, ...typography.weight.bold },
  retryButton: { marginTop: spacing.lg, backgroundColor: colors.accent.DEFAULT, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md },
  retryButtonText: { color: colors.text.inverse, ...typography.weight.bold },
  modalBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg.elevated, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { ...typography.size.xl, ...typography.weight.black, color: colors.text.primary },
  label: { ...typography.weight.semibold, ...typography.size.sm, color: colors.text.secondary, marginTop: spacing.sm },
  input: { backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16, color: colors.text.primary },
  modeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  modeOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.hairlineStrong },
  modeOptionActive: { backgroundColor: colors.accent.soft, borderColor: colors.accent.DEFAULT },
  modeOptionText: { ...typography.size.sm, color: colors.text.secondary, ...typography.weight.semibold },
  modeOptionTextActive: { color: colors.accent.DEFAULT },
  createConfirm: { backgroundColor: colors.accent.DEFAULT, paddingVertical: spacing.lg, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
  createConfirmBusy: { opacity: 0.6 },
  createConfirmText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
});
