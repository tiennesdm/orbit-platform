/**
 * Marketplace — grid of listings + new listing composer
 */

import { useState } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet, ScrollView, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, MapPin, X, Tag } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const CATEGORIES = ['All', 'Electronics', 'Vintage', 'Stationery', 'Photography', 'Clothing', 'Home', 'Other'];
const CATEGORY_EMOJI: Record<string, string> = {
  Electronics: '⌨️', Vintage: '⌨️', Stationery: '📓', Photography: '📷',
  Clothing: '👕', Home: '🏠', Other: '📦',
};

const MOCK_LISTINGS = [
  { id: 'l1', title: 'Vintage Typewriter (Working)', priceCents: 450000, currency: 'INR', category: 'Vintage', location: 'Mumbai, MH', sellerHandle: 'alice' },
  { id: 'l2', title: 'Handmade Leather Notebook', priceCents: 35000, currency: 'INR', category: 'Stationery', location: 'Bangalore, KA', sellerHandle: 'bob' },
  { id: 'l3', title: 'Mechanical Keyboard (Custom)', priceCents: 1200000, currency: 'INR', category: 'Electronics', location: 'Delhi, DL', sellerHandle: 'carol' },
  { id: 'l4', title: 'Camera Lens 50mm f/1.4', priceCents: 2800000, currency: 'INR', category: 'Photography', location: 'Pune, MH', sellerHandle: 'diana' },
];

export default function Marketplace() {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [composing, setComposing] = useState(false);

  const filtered = MOCK_LISTINGS.filter((l) => {
    if (category !== 'All' && l.category !== category) return false;
    if (search && !`${l.title}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (composing) return <ComposeListing onClose={() => setComposing(false)} />;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Marketplace</Text>
        <Pressable onPress={() => setComposing(true)} style={styles.addBtn}>
          <Plus size={20} color="#fff" />
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <Search size={16} color={colors.text.tertiary} style={styles.searchIcon} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search listings…"
          placeholderTextColor={colors.text.tertiary}
          style={styles.searchInput}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={[styles.tab, category === c && styles.tabActive]}
          >
            <Text style={[styles.tabText, category === c && styles.tabTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ padding: spacing.sm }}
        contentContainerStyle={{ paddingBottom: 80 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.thumb}>
              <Text style={styles.thumbEmoji}>{CATEGORY_EMOJI[item.category] || '📦'}</Text>
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.cardPrice}>₹{(item.priceCents / 100).toLocaleString('en-IN')}</Text>
              <View style={styles.cardMeta}>
                <MapPin size={9} color={colors.text.tertiary} />
                <Text style={styles.cardMetaText} numberOfLines={1}>{item.location}</Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No listings in this category</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function ComposeListing({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priceInr, setPriceInr] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [location, setLocation] = useState('');

  const post = useMutation({
    mutationFn: () => api.createListing({
      title, description,
      priceCents: Math.round(parseFloat(priceInr || '0') * 100),
      currency: 'INR',
      category, location,
    }),
    onSuccess: onClose,
    onError: (e: any) => Alert.alert('Failed', e.message),
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.iconBtn}>
          <X size={20} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>New listing</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 80 }}>
        <View style={styles.uploadBox}>
          <Text style={styles.uploadEmoji}>📷</Text>
          <Text style={styles.uploadText}>Add photos</Text>
        </View>
        <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={colors.text.tertiary} style={styles.input} />
        <TextInput value={description} onChangeText={setDescription} placeholder="Description, condition, dimensions…" placeholderTextColor={colors.text.tertiary} multiline style={[styles.input, { minHeight: 80 }]} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Price (₹)</Text>
            <TextInput value={priceInr} onChangeText={setPriceInr} placeholder="4500" placeholderTextColor={colors.text.tertiary} keyboardType="numeric" style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, category === c && styles.chipActive]}
                >
                  <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
        <TextInput value={location} onChangeText={setLocation} placeholder="Location (e.g., Mumbai, MH)" placeholderTextColor={colors.text.tertiary} style={styles.input} />
        <Pressable
          onPress={() => post.mutate()}
          disabled={!title || !priceInr || post.isPending}
          style={[styles.submitBtn, (!title || !priceInr || post.isPending) && { opacity: 0.5 }]}
        >
          <Text style={styles.submitText}>{post.isPending ? 'Posting…' : 'List for sale'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.hairline },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg.subtle, justifyContent: 'center', alignItems: 'center' },
  title: { ...typography.size.xl, ...typography.weight.bold, color: colors.text.primary, flex: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent.DEFAULT, justifyContent: 'center', alignItems: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: spacing.md, backgroundColor: colors.bg.subtle, borderRadius: radius.full, paddingHorizontal: spacing.md, height: 40 },
  searchIcon: { marginRight: spacing.sm },
  searchInput: { flex: 1, ...typography.size.base, color: colors.text.primary, padding: 0 },
  tabs: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: 6 },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg.subtle, marginRight: 6 },
  tabActive: { backgroundColor: colors.accent.DEFAULT },
  tabText: { ...typography.size.sm, color: colors.text.secondary },
  tabTextActive: { color: '#fff', ...typography.weight.semibold },
  card: { flex: 1, margin: spacing.xs, backgroundColor: colors.bg.subtle, borderRadius: radius.lg, overflow: 'hidden' },
  thumb: { aspectRatio: 1, backgroundColor: colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  thumbEmoji: { fontSize: 48 },
  cardBody: { padding: spacing.sm },
  cardTitle: { ...typography.size.sm, ...typography.weight.semibold, color: colors.text.primary, marginBottom: 4, minHeight: 32 },
  cardPrice: { ...typography.size.base, ...typography.weight.bold, color: colors.accent.DEFAULT },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  cardMetaText: { ...typography.size.xs, color: colors.text.tertiary, flex: 1 },
  empty: { padding: spacing.xxxl, alignItems: 'center' },
  emptyText: { ...typography.size.base, color: colors.text.tertiary },
  uploadBox: { height: 160, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.hairline, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  uploadEmoji: { fontSize: 40 },
  uploadText: { ...typography.size.base, color: colors.text.tertiary, marginTop: spacing.xs },
  input: { backgroundColor: colors.bg.subtle, borderRadius: radius.md, padding: spacing.md, ...typography.size.base, color: colors.text.primary, textAlignVertical: 'top' },
  label: { ...typography.size.xs, color: colors.text.tertiary, marginBottom: 4 },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.bg.subtle, marginRight: 6 },
  chipActive: { backgroundColor: colors.accent.DEFAULT },
  chipText: { ...typography.size.sm, color: colors.text.secondary },
  chipTextActive: { color: '#fff', ...typography.weight.semibold },
  submitBtn: { backgroundColor: colors.accent.DEFAULT, padding: spacing.md, borderRadius: radius.lg, alignItems: 'center' },
  submitText: { color: '#fff', ...typography.size.base, ...typography.weight.semibold },
});
