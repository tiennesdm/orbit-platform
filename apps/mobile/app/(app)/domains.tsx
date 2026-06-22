/**
 * Custom Domain — own your handle on your own domain
 *   - Verify DNS TXT
 *   - Link AT Protocol identity
 *   - Show federation status
 */

import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, CheckCircle2, Globe } from 'lucide-react-native';
import { api } from '@/lib/api';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function Domains() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['federation', 'status'],
    queryFn: () => api.getFederationStatus(),
  });
  const [domain, setDomain] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const status: any = data ?? {};

  const onVerify = async () => {
    if (!domain.trim()) {
      Alert.alert('Add a domain', 'e.g. yourname.com');
      return;
    }
    setBusy(true);
    setVerifyResult(null);
    try {
      const res = await api.verifyDomain(domain.trim());
      setVerifyResult(res);
    } catch (e: any) {
      Alert.alert('Verification failed', e?.message ?? 'Try again');
    } finally {
      setBusy(false);
    }
  };

  const onLink = async () => {
    if (!verifyResult?.verified) {
      Alert.alert('Verify first', 'DNS must be verified before linking');
      return;
    }
    setBusy(true);
    try {
      await api.linkDomain(domain.trim());
      queryClient.invalidateQueries({ queryKey: ['federation', 'status'] });
      Alert.alert('Linked!', `${domain} is now your handle`);
    } catch (e: any) {
      Alert.alert('Link failed', e?.message ?? 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your domain</Text>
      <Text style={styles.subtitle}>Take your handle anywhere. Your identity is portable.</Text>

      {isLoading ? (
        <ActivityIndicator color={colors.accent.DEFAULT} />
      ) : (
        <>
          {status.linkedDomain && (
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <CheckCircle2 size={20} color="#10B981" />
                <Text style={styles.statusTitle}>Linked</Text>
              </View>
              <Text style={styles.statusDomain}>{status.linkedDomain}</Text>
              <Text style={styles.statusHint}>
                Friends can now find you at @{status.handle} on the open web.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Link a domain</Text>
            <Text style={styles.cardHint}>
              Add this TXT record to your DNS, then verify:
            </Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>
                _orbit.{domain || 'yourname.com'}  TXT  "orbit-verify={status.pendingToken || '<token>'}"
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={domain}
              onChangeText={setDomain}
              placeholder="yourname.com"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Pressable
              style={[styles.button, busy && styles.buttonBusy]}
              onPress={onVerify}
              disabled={busy}
            >
              {busy ? <ActivityIndicator color={colors.text.inverse} /> : (
                <><Globe size={16} color={colors.text.inverse} /><Text style={styles.buttonText}>Verify DNS</Text></>
              )}
            </Pressable>

            {verifyResult && (
              <View style={[styles.verifyResult, verifyResult.verified ? styles.verifyOk : styles.verifyFail]}>
                <Text style={styles.verifyText}>
                  {verifyResult.verified ? '✓ Verified' : '✗ Not found'}
                </Text>
                {verifyResult.verified && (
                  <Pressable onPress={onLink} style={[styles.linkButton, busy && styles.buttonBusy]} disabled={busy}>
                    <Link2 size={16} color={colors.text.inverse} />
                    <Text style={styles.buttonText}>Link domain</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>AT Protocol</Text>
            <Text style={styles.cardHint}>
              Resolve any Bluesky-style handle to its DID:
            </Text>
            <ATResolver />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function ATResolver() {
  const [handle, setHandle] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const onResolve = async () => {
    if (!handle.trim()) return;
    setBusy(true);
    try {
      const res = await api.resolveHandleAtProtocol(handle.trim());
      setResult(res);
    } catch (e: any) {
      Alert.alert('Resolve failed', e?.message ?? 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={handle}
          onChangeText={setHandle}
          placeholder="alice.bsky.social"
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable onPress={onResolve} style={[styles.button, { paddingHorizontal: spacing.lg }, busy && styles.buttonBusy]} disabled={busy}>
          <Text style={styles.buttonText}>{busy ? '…' : 'Resolve'}</Text>
        </Pressable>
      </View>
      {result && (
        <View style={styles.atResult}>
          <Text style={styles.atLabel}>DID</Text>
          <Text style={styles.atValue}>{result.did ?? '(none)'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.elevated },
  content: { padding: spacing.xl, paddingTop: spacing.xxxl, gap: spacing.lg },
  title: { ...typography.size.xxl, ...typography.weight.black, color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { ...typography.size.sm, color: colors.text.secondary, marginBottom: spacing.md },
  statusCard: { backgroundColor: '#10B98122', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.xs, borderWidth: 1, borderColor: '#10B981' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusTitle: { ...typography.size.lg, ...typography.weight.bold, color: '#10B981' },
  statusDomain: { ...typography.size.base, ...typography.weight.semibold, color: colors.text.primary },
  statusHint: { ...typography.size.sm, color: colors.text.secondary },
  card: { backgroundColor: colors.bg.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  cardTitle: { ...typography.size.lg, ...typography.weight.bold, color: colors.text.primary },
  cardHint: { ...typography.size.sm, color: colors.text.secondary, lineHeight: 18 },
  codeBlock: { backgroundColor: colors.text.primary, padding: spacing.md, borderRadius: radius.sm },
  codeText: { color: '#A7F3D0', fontFamily: 'monospace', fontSize: 12, lineHeight: 16 },
  input: { backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.hairlineStrong, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, fontSize: 16, color: colors.text.primary },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.accent.DEFAULT, paddingVertical: spacing.md, borderRadius: radius.md },
  buttonBusy: { opacity: 0.6 },
  buttonText: { color: colors.text.inverse, ...typography.weight.bold },
  verifyResult: { padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verifyOk: { backgroundColor: '#10B98122', borderWidth: 1, borderColor: '#10B981' },
  verifyFail: { backgroundColor: '#EF444422', borderWidth: 1, borderColor: '#EF4444' },
  verifyText: { ...typography.weight.bold, color: colors.text.primary },
  linkButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.accent.DEFAULT, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md },
  atResult: { backgroundColor: colors.bg.elevated, padding: spacing.md, borderRadius: radius.md },
  atLabel: { ...typography.size.xs, color: colors.text.tertiary, textTransform: 'uppercase', ...typography.weight.bold },
  atValue: { ...typography.size.sm, color: colors.text.primary, fontFamily: 'monospace', marginTop: 2 },
});
