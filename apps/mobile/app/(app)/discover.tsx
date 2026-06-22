/**
 * Discover — universal search with tabs + trending + suggestions
 */

import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Search, TrendingUp, Hash, X } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const TABS = ['all', 'users', 'posts', 'groups', 'marketplace'] as const;
type Tab = typeof TABS[number];

const TRENDING = [
  { tag: 'AI', posts: '12.4K' },
  { tag: 'Web3', posts: '8.7K' },
  { tag: 'Climate', posts: '6.2K' },
  { tag: 'IndieHackers', posts: '4.1K' },
  { tag: 'DesignTips', posts: '3.8K' },
];

const SUGGESTED = [
  { handle: 'alice', displayName: 'Alice', bio: 'AI researcher · Climate tech', followers: '12K' },
  { handle: 'bob', displayName: 'Bob', bio: 'Building tools for creators', followers: '8.5K' },
  { handle: 'carol', displayName: 'Carol', bio: 'Indie hacker · Ex-Stripe', followers: '5.2K' },
];

export default function Discover() {
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');

  const { data: results, isFetching } = useQuery({
    queryKey: ['search', query, tab],
    queryFn: () => api.search(query) as any,
    enabled: query.length >= 2,
    staleTime: 60_000,
  });

  const resultList: any[] = results?.results || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchRow}>
          <Search size={18} color={colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search ORBIT…"
            placeholderTextColor={colors.text.tertiary}
            style={styles.input}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
              <X size={16} color={colors.text.tertiary} />
            </Pressable>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {isFetching && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.DEFAULT} />
          <Text style={styles.muted}>Searching…</Text>
        </View>
      )}

      {/* Search results */}
      {!isFetching && query.length >= 2 && (
        <FlatList
          data={resultList.slice(0, 30)}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.resultMeta}>
              {resultList.length} result{resultList.length !== 1 ? 's' : ''} for "{query}"
            </Text>
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.muted}>No results</Text>
            </View>
          }
          renderItem={({ item }) => (
            <ResultRow item={item} type={tab} />
          )}
        />
      )}

      {/* Default: trending + suggested */}
      {!isFetching && query.length < 2 && (
        <ScrollView contentContainerStyle={styles.list}>
          <Section title="Trending" icon={<TrendingUp size={16} color={colors.accent.DEFAULT} />}>
            {TRENDING.map((h, i) => (
              <View key={h.tag} style={styles.row}>
                <Text style={styles.rank}>{i + 1}</Text>
                <Hash size={14} color={colors.accent.DEFAULT} />
                <Text style={styles.tagText}>{h.tag}</Text>
                <Text style={styles.muted}>{h.posts} posts</Text>
              </View>
            ))}
          </Section>

          <Section title="Suggested for you">
            {SUGGESTED.map((u) => (
              <View key={u.handle} style={styles.suggestedRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{u.displayName[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.author}>{u.displayName}</Text>
                  <Text style={styles.handle}>@{u.handle} · {u.followers}</Text>
                  <Text style={styles.bio}>{u.bio}</Text>
                </View>
                <Pressable style={styles.followBtn}>
                  <Text style={styles.followBtnText}>Follow</Text>
                </Pressable>
              </View>
            ))}
          </Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function ResultRow({ item, type }: { item: any; type: Tab }) {
  if (type === 'users' || item.handle) {
    return (
      <View style={styles.suggestedRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.display_name || item.displayName || '?')[0]}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{item.display_name || item.displayName}</Text>
          <Text style={styles.handle}>@{item.handle}</Text>
          {item.bio && <Text style={styles.bio} numberOfLines={1}>{item.bio}</Text>}
        </View>
        <Pressable style={styles.followBtn}>
          <Text style={styles.followBtnText}>Follow</Text>
        </Pressable>
      </View>
    );
  }
  if (item.content_text !== undefined) {
    return (
      <View style={styles.postRow}>
        <Text style={styles.handle}>@{item.handle || 'user'} · {item.mode}</Text>
        <Text style={styles.content}>{item.content_text}</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.bg.elevated,
  },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, letterSpacing: -0.5, marginBottom: spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.subtle,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    height: 40,
  },
  searchIcon: { marginRight: spacing.sm },
  input: { flex: 1, ...typography.size.base, color: colors.text.primary, padding: 0 },
  clearBtn: { padding: 4 },
  tabs: { marginTop: spacing.md, paddingBottom: spacing.sm },
  tab: { paddingHorizontal: spacing.lg, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg.subtle, marginRight: 6 },
  tabActive: { backgroundColor: colors.accent.DEFAULT },
  tabText: { ...typography.size.sm, color: colors.text.secondary, ...typography.weight.medium },
  tabTextActive: { color: '#fff', ...typography.weight.semibold },
  center: { padding: spacing.xxxl, alignItems: 'center' },
  muted: { ...typography.size.sm, color: colors.text.tertiary, marginTop: spacing.xs },
  list: { padding: spacing.lg, gap: spacing.sm },
  resultMeta: { ...typography.size.sm, color: colors.text.tertiary, marginBottom: spacing.sm },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  sectionTitle: { ...typography.size.lg, ...typography.weight.bold, color: colors.text.primary },
  sectionContent: { backgroundColor: colors.bg.subtle, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  rank: { width: 24, ...typography.size.sm, color: colors.text.tertiary, textAlign: 'center' },
  tagText: { flex: 1, ...typography.weight.semibold, color: colors.text.primary },
  suggestedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', ...typography.weight.bold, fontSize: 18 },
  author: { ...typography.weight.semibold, color: colors.text.primary },
  handle: { ...typography.size.sm, color: colors.text.tertiary },
  bio: { ...typography.size.sm, color: colors.text.secondary, marginTop: 2 },
  followBtn: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.accent.DEFAULT },
  followBtnText: { color: '#fff', ...typography.size.sm, ...typography.weight.semibold },
  postRow: { padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.hairline, gap: 4 },
  content: { ...typography.size.base, color: colors.text.primary, lineHeight: 20 },
});
