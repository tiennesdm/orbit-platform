/**
 * Home feed — chronological posts from people you follow
 */

import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { useAuth } from '@/store/auth';

export default function Home() {
  const user = useAuth((s) => s.user);
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['feed', 'home'],
    queryFn: () => api.getFeed(),
  });

  const posts = data?.posts ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Home</Text>
        <Pressable onPress={() => refetch()}>
          <Text style={styles.refresh}>↻</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent.DEFAULT} size="large" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyTitle}>Your feed is empty</Text>
          <Text style={styles.emptyText}>
            Follow some people to see their posts here.{'\n'}
            Try @{user?.handle ?? 'me'} → tap profile → search
          </Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item: any) => `${item.authorId}-${item.postId}`}
          renderItem={({ item }) => <PostCard post={item} />}
          contentContainerStyle={styles.feed}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent.DEFAULT} />
          }
        />
      )}
    </View>
  );
}

function PostCard({ post }: { post: any }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(post.authorHandle || '?').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.author}>{post.authorDisplayName || post.authorHandle || 'unknown'}</Text>
          <Text style={styles.handle}>@{post.authorHandle || 'unknown'}</Text>
        </View>
        <View style={styles.modePill}>
          <Text style={styles.modePillText}>{post.mode}</Text>
        </View>
      </View>
      <Text style={styles.content}>{post.contentText}</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => api.likePost(post.authorId, post.postId)} style={styles.action}>
          <Text style={styles.actionIcon}>♡</Text>
          <Text style={styles.actionText}>{post.likeCount ?? 0}</Text>
        </Pressable>
        <Pressable style={styles.action}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionText}>{post.commentCount ?? 0}</Text>
        </Pressable>
        <Pressable style={styles.action}>
          <Text style={styles.actionIcon}>↻</Text>
          <Text style={styles.actionText}>{post.shareCount ?? 0}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, letterSpacing: -0.5 },
  refresh: { fontSize: 24, color: colors.text.secondary, padding: spacing.sm },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
  emptyTitle: { ...typography.size.xl, ...typography.weight.bold, color: colors.text.primary, marginBottom: spacing.sm },
  emptyText: { ...typography.size.base, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  feed: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.text.inverse, ...typography.weight.bold },
  author: { ...typography.weight.bold, ...typography.size.base, color: colors.text.primary },
  handle: { ...typography.size.sm, color: colors.text.secondary },
  modePill: {
    marginLeft: 'auto',
    backgroundColor: colors.accent.soft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
  modePillText: { color: colors.accent.DEFAULT, fontSize: 10, ...typography.weight.bold, textTransform: 'uppercase' },
  content: { ...typography.size.base, color: colors.text.primary, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: spacing.xl },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionIcon: { fontSize: 18, color: colors.text.secondary },
  actionText: { ...typography.size.sm, color: colors.text.secondary },
});
