import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Ban, ShieldCheck, Users } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { fetchAllClients, setUserBanned } from '../../services/admin';
import { UserProfile } from '../../types/models';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';

export default function AdminClientsScreen() {
  const [clients, setClients] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchAllClients();
      setClients(data);
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно зареждане на клиентите.');
    }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function toggleBan(client: UserProfile) {
    setBusyUid(client.uid);
    try {
      await setUserBanned(client.uid, !client.banned);
      await load();
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешна операция.');
    } finally {
      setBusyUid(null);
    }
  }

  if (loading) {
    return <LoadingScreen label="Зареждане на клиентите..." />;
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Клиенти</Text>
      <FlatList
        data={clients}
        keyExtractor={(c) => c.uid}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState icon={Users} text="Все още няма регистрирани клиенти." />}
        renderItem={({ item }) => {
          const busy = busyUid === item.uid;
          return (
            <View style={[styles.card, item.banned && styles.cardBanned]}>
              <View style={styles.cardTop}>
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarInitial}>{item.name?.[0] ?? '?'}</Text>
                </View>
                <View style={styles.flexShrink}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.phone}</Text>
                  <Text style={styles.meta}>{item.email}</Text>
                  {item.banned ? (
                    <Text style={styles.bannedTag}>БАНИРАН</Text>
                  ) : (
                    <View style={styles.okRow}>
                      <ShieldCheck size={12} color={colors.textMuted} />
                      <Text style={styles.okTag}>Активен</Text>
                    </View>
                  )}
                </View>
                <Pressable
                  style={[styles.actionButton, item.banned ? styles.unbanButton : styles.banButton]}
                  disabled={busy}
                  onPress={() => toggleBan(item)}
                >
                  {busy ? (
                    <ActivityIndicator color={item.banned ? colors.text : '#ffffff'} size="small" />
                  ) : (
                    <>
                      <Ban size={16} color={item.banned ? colors.text : '#ffffff'} />
                      <Text style={item.banned ? styles.unbanLabel : styles.banLabel}>
                        {item.banned ? 'Отбани' : 'Бани'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 20 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  list: { paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10, ...shadows.card },
  cardBanned: { borderWidth: 1, borderColor: colors.danger },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  avatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.text, fontWeight: '700', fontSize: 16 },
  flexShrink: { flexShrink: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bannedTag: { color: colors.danger, fontWeight: '800', fontSize: 11, marginTop: 6, letterSpacing: 1 },
  okRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  okTag: { color: colors.textMuted, fontSize: 11 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  banButton: { backgroundColor: colors.danger },
  banLabel: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  unbanButton: { backgroundColor: colors.surface },
  unbanLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
