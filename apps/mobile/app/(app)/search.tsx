/**
 * Search — universal search across users, posts, groups, listings
 */

import { useState } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function Search() {
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['search', q],
    queryFn: () => api.search(q),
    enabled: q.length > 2,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <TextInput
        style={styles.input}
        placeholder="Search users, posts, groups, listings..."
        placeholderTextColor={colors.text.tertiary}
        value={q}
        onChangeText={setQ}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {q.length <= 2 ? (
        <Text style={styles.hint}>Type at least 3 characters</Text>
      ) : isLoading ? (
        <ActivityIndicator color={colors.accent.DEFAULT} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={data?.results ?? []}
          keyExtractor={(item: any) => `${item.type}-${item.id}`}
          renderItem={({ item }: any) => (
            <View style={styles.result}>
              <Text style={styles.resultType}>{item.type}</Text>
              <Text style={styles.resultTitle}>{item.title}</Text>
              {item.snippet && <Text style={styles.resultSnippet}>{item.snippet}</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated, padding: spacing.xl, paddingTop: spacing.xxxl },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.bg.card,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.size.base,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  hint: { ...typography.size.sm, color: colors.text.tertiary, textAlign: 'center', marginTop: spacing.lg },
  result: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  resultType: { ...typography.size.xs, color: colors.accent.DEFAULT, ...typography.weight.bold, textTransform: 'uppercase' },
  resultTitle: { ...typography.size.base, ...typography.weight.semibold, color: colors.text.primary },
  resultSnippet: { ...typography.size.sm, color: colors.text.secondary },
});
