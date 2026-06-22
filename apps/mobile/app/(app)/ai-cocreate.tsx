/**
 * AI Co-Create — captions, long text, image, video, audio, hashtags
 */

import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Sparkles, Type, Image as ImageIcon, Video, Music, Hash } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

type Tab = 'caption' | 'longtext' | 'image' | 'video' | 'audio' | 'hashtags';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'caption', label: 'Caption', icon: Sparkles },
  { id: 'longtext', label: 'Long text', icon: Type },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'hashtags', label: 'Hashtags', icon: Hash },
];

export default function AICoCreate() {
  const [tab, setTab] = useState<Tab>('caption');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const onGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Add a prompt', 'Tell the AI what to make');
      return;
    }
    setBusy(true);
    setResult('');
    try {
      let res: any;
      switch (tab) {
        case 'caption': res = await api.generateAICaption({ mode: 'public', topic: prompt }); break;
        case 'longtext': res = await api.generateAILongText({ topic: prompt }); break;
        case 'image': res = await api.generateAIImage({ prompt }); break;
        case 'video': res = await api.generateAIVideo({ prompt }); break;
        case 'audio': res = await api.generateAIAudio({ text: prompt }); break;
        case 'hashtags': res = await api.generateAIHashtags({ content: prompt }); break;
      }
      setResult(formatResult(tab, res));
    } catch (e: any) {
      Alert.alert('Generation failed', e?.message ?? 'AI service unavailable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Co-Create</Text>
        <Text style={styles.subtitle}>Your thought partner, not your replacement</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Pressable
              key={t.id}
              style={[styles.tab, tab === t.id && styles.tabActive]}
              onPress={() => { setTab(t.id); setResult(''); }}
            >
              <Icon size={16} color={tab === t.id ? colors.accent.DEFAULT : colors.text.secondary} />
              <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.body}>
        <Text style={styles.label}>Prompt</Text>
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder={placeholderFor(tab)}
          placeholderTextColor={colors.text.tertiary}
          multiline
        />

        <Pressable
          style={[styles.generate, busy && styles.generateBusy]}
          onPress={onGenerate}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.text.inverse} />
          ) : (
            <><Sparkles size={16} color={colors.text.inverse} /><Text style={styles.generateText}>Generate</Text></>
          )}
        </Pressable>

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultLabel}>Result</Text>
            <Text style={styles.resultText}>{result}</Text>
            <Pressable onPress={() => setResult('')}>
              <Text style={styles.clearText}>Clear</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            AI suggestions are labeled in your posts. You can edit or discard them — final say is always yours.
          </Text>
        </View>
      </View>
    </View>
  );
}

function placeholderFor(tab: Tab): string {
  switch (tab) {
    case 'caption': return 'A short caption about…';
    case 'longtext': return 'Write a long-form post about…';
    case 'image': return 'A serene mountain landscape at dawn';
    case 'video': return 'A timelapse of a city at night';
    case 'audio': return 'Text to convert to speech…';
    case 'hashtags': return 'Post content to extract hashtags from…';
  }
}

function formatResult(tab: Tab, res: any): string {
  if (!res) return 'No result';
  if (tab === 'caption' || tab === 'longtext') return res.text ?? res.caption ?? res.content ?? JSON.stringify(res);
  if (tab === 'image' || tab === 'video') return res.url ? `Generated. Preview: ${res.url}` : JSON.stringify(res);
  if (tab === 'audio') return res.url ? `Audio: ${res.url}` : JSON.stringify(res);
  if (tab === 'hashtags') return Array.isArray(res.hashtags) ? res.hashtags.map((h: string) => `#${h}`).join(' ') : JSON.stringify(res);
  return JSON.stringify(res);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: { padding: spacing.xl, paddingTop: spacing.xxxl },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { ...typography.size.sm, color: colors.text.secondary, marginTop: 2 },
  tabs: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.md },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.bg.card,
    borderWidth: 1, borderColor: colors.hairlineStrong,
  },
  tabActive: { backgroundColor: colors.accent.soft, borderColor: colors.accent.DEFAULT },
  tabText: { ...typography.size.sm, color: colors.text.secondary, ...typography.weight.semibold },
  tabTextActive: { color: colors.accent.DEFAULT },
  body: { padding: spacing.xl, gap: spacing.md },
  label: { ...typography.weight.semibold, ...typography.size.sm, color: colors.text.secondary },
  input: {
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.hairlineStrong,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    fontSize: 16, color: colors.text.primary, minHeight: 80, textAlignVertical: 'top',
  },
  generate: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.accent.DEFAULT, paddingVertical: spacing.lg, borderRadius: radius.md,
  },
  generateBusy: { opacity: 0.6 },
  generateText: { color: colors.text.inverse, ...typography.weight.bold, fontSize: 16 },
  resultCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.hairlineStrong,
  },
  resultLabel: { ...typography.size.xs, ...typography.weight.bold, color: colors.accent.DEFAULT, textTransform: 'uppercase' },
  resultText: { ...typography.size.base, color: colors.text.primary, lineHeight: 22 },
  clearText: { color: colors.text.tertiary, ...typography.size.sm, alignSelf: 'flex-end' },
  disclaimer: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.accent.soft, borderRadius: radius.md },
  disclaimerText: { ...typography.size.xs, color: colors.text.secondary, lineHeight: 16 },
});
