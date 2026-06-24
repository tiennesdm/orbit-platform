/**
 * Reels — vertical TikTok-style video feed
 */

import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, Dimensions,
  ActivityIndicator, Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Heart, MessageCircle, Share2, Bookmark, Volume2, VolumeX, MoreHorizontal } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { useAuth } from '@/store/auth';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const MOCK_REELS = [
  {
    id: '1',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    caption: 'A peaceful moment in nature 🌿 #mindfulness',
    author: { handle: 'alice', displayName: 'Alice' },
    likeCount: 1284,
    commentCount: 23,
    shareCount: 7,
    musicTitle: 'Forest Lullaby — Ambient',
  },
  {
    id: '2',
    url: 'https://www.w3schools.com/html/movie.mp4',
    caption: 'Building a startup: Day 100 🚀',
    author: { handle: 'bob', displayName: 'Bob' },
    likeCount: 5672,
    commentCount: 145,
    shareCount: 89,
    musicTitle: 'Tech Energy — Synthwave',
  },
  {
    id: '3',
    url: 'https://www.w3schools.com/html/mov_bbb.mp4',
    caption: 'Quick recipe: 5-min ramen hack 🍜',
    author: { handle: 'carol', displayName: 'Carol' },
    likeCount: 8921,
    commentCount: 412,
    shareCount: 234,
    musicTitle: 'Cooking Vibes — Lo-fi',
  },
];

export default function Reels() {
  const user = useAuth((s) => s.user);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const videoRefs = useRef<{ [key: string]: any }>({});

  function toggleLike(id: string) {
    const next = new Set(liked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLiked(next);
  }

  function onViewableItemsChanged({ viewableItems }: any) {
    if (viewableItems.length > 0) {
      const idx = viewableItems[0].index;
      setActiveIndex(idx);
      setPaused(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Reels</Text>
      </View>
      <FlatList
        data={MOCK_REELS}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT - 100}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        renderItem={({ item, index }) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex}
            paused={paused}
            muted={muted}
            liked={liked.has(item.id)}
            onLike={() => toggleLike(item.id)}
            onTogglePause={() => setPaused(!paused)}
            onToggleMute={() => setMuted(!muted)}
            videoRef={(ref: any) => { videoRefs.current[item.id] = ref; }}
          />
        )}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT - 100,
          offset: (SCREEN_HEIGHT - 100) * index,
          index,
        })}
      />
    </SafeAreaView>
  );
}

function ReelItem({ reel, isActive, paused, muted, liked, onLike, onTogglePause, onToggleMute, videoRef }: any) {
  return (
    <View style={styles.item}>
      {isActive && !paused ? (
        <Video
          ref={videoRef}
          source={{ uri: reel.url }}
          style={StyleSheet.absoluteFill as any}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted={muted}
          shouldPlay={isActive && !paused}
          useNativeControls={false}
          usePoster={false}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#fff', fontSize: 48 }}>🎬</Text>
        </View>
      )}
      <View style={styles.gradient} />

      {/* Top controls */}
      <View style={styles.topControls}>
        <Pressable onPress={onToggleMute} style={styles.iconBtn}>
          {muted ? <VolumeX size={20} color="#fff" /> : <Volume2 size={20} color="#fff" />}
        </Pressable>
        <Pressable onPress={onTogglePause} style={styles.iconBtn}>
          <Text style={{ color: '#fff', fontSize: 18 }}>{paused ? '▶' : '❚❚'}</Text>
        </Pressable>
      </View>

      {/* Bottom info */}
      <View style={styles.bottomInfo}>
        <View style={styles.authorRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{reel.author.displayName[0]}</Text>
          </View>
          <Text style={styles.author}>@{reel.author.handle}</Text>
          <Pressable style={styles.followBtn}>
            <Text style={styles.followText}>Follow</Text>
          </Pressable>
        </View>
        <Text style={styles.caption}>{reel.caption}</Text>
        {reel.musicTitle && (
          <Text style={styles.music}>🎵 {reel.musicTitle}</Text>
        )}
      </View>

      {/* Right action bar */}
      <View style={styles.actionBar}>
        <Pressable style={styles.action} onPress={onLike}>
          <Heart size={28} color={liked ? colors.error : '#fff'} fill={liked ? colors.error : 'transparent'} />
          <Text style={styles.actionText}>{(reel.likeCount + (liked ? 1 : 0)).toLocaleString()}</Text>
        </Pressable>
        <Pressable style={styles.action}>
          <MessageCircle size={28} color="#fff" />
          <Text style={styles.actionText}>{reel.commentCount}</Text>
        </Pressable>
        <Pressable style={styles.action}>
          <Share2 size={26} color="#fff" />
          <Text style={styles.actionText}>{reel.shareCount}</Text>
        </Pressable>
        <Pressable style={styles.action}>
          <Bookmark size={24} color="#fff" />
        </Pressable>
        <Pressable style={styles.action}>
          <MoreHorizontal size={24} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: spacing.md, paddingTop: spacing.lg, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  title: { ...typography.size.xl, ...typography.weight.black, color: '#fff' },
  item: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT - 100, backgroundColor: '#000', overflow: 'hidden' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 200, backgroundColor: 'transparent' },
  topControls: { position: 'absolute', right: spacing.md, top: 80, gap: spacing.md, alignItems: 'center' },
  iconBtn: { backgroundColor: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 20 },
  bottomInfo: { position: 'absolute', left: spacing.lg, right: 80, bottom: 80 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', ...typography.weight.bold, fontSize: 14 },
  author: { color: '#fff', ...typography.weight.bold, fontSize: 16 },
  followBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full },
  followText: { color: '#fff', ...typography.size.sm, ...typography.weight.semibold },
  caption: { color: '#fff', ...typography.size.base, lineHeight: 20, marginBottom: spacing.xs },
  music: { color: 'rgba(255,255,255,0.8)', ...typography.size.xs },
  actionBar: { position: 'absolute', right: spacing.md, bottom: 80, gap: spacing.lg, alignItems: 'center' },
  action: { alignItems: 'center', gap: 4 },
  actionText: { color: '#fff', ...typography.size.xs, ...typography.weight.semibold },
});
