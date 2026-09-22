import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, FlatList, Pressable, ActivityIndicator, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Ban, Car, CheckCircle2, Clock, Star, UserCheck } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { formatDualCurrency } from '../../utils/currency';
import {
  AdminDriverRow,
  fetchAllDriversWithDues,
  markDriverSettled,
  setDriverApproved,
  setUserBanned,
} from '../../services/admin';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';

export default function AdminDriversScreen() {
  const [rows, setRows] = useState<AdminDriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchAllDriversWithDues();
      setRows(data);
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно зареждане на шофьорите.');
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

  async function toggleBan(row: AdminDriverRow) {
    setBusyUid(row.uid);
    try {
      await setUserBanned(row.uid, !row.banned);
      await load();
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешна операция.');
    } finally {
      setBusyUid(null);
    }
  }

  async function approve(row: AdminDriverRow) {
    setBusyUid(row.uid);
    try {
      await setDriverApproved(row.uid, true);
      await load();
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешна операция.');
    } finally {
      setBusyUid(null);
    }
  }

  function confirmSettle(row: AdminDriverRow) {
    Alert.alert(
      'Отбележи като платено',
      `${row.name} дължи ${formatDualCurrency(row.owedBGN)}. Отбележи като събрано?`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Потвърди',
          onPress: async () => {
            setBusyUid(row.uid);
            try {
              await markDriverSettled(row.uid);
              await load();
            } catch (e) {
              Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешна операция.');
            } finally {
              setBusyUid(null);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return <LoadingScreen label="Зареждане на шофьорите..." />;
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Шофьори</Text>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.uid}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState icon={Car} text="Все още няма регистрирани шофьори." />}
        renderItem={({ item }) => {
          const busy = busyUid === item.uid;
          return (
            <View style={[styles.card, item.banned && styles.cardBanned, !item.approved && styles.cardPending]}>
              <View style={styles.cardTop}>
                {item.carPhotoUrl ? (
                  <Image source={{ uri: item.carPhotoUrl }} style={styles.carThumb} />
                ) : (
                  <View style={styles.carThumbPlaceholder}>
                    <Car size={18} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.flexShrink}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.phone || item.email}</Text>
                  {!!item.vehicle && (
                    <Text style={styles.meta}>
                      {item.vehicle.color} {item.vehicle.make} {item.vehicle.model} · {item.vehicle.plate}
                    </Text>
                  )}
                </View>
                <View style={styles.ratingRow}>
                  <Star size={13} color={colors.warning} fill={colors.warning} />
                  <Text style={styles.ratingText}>{item.rating.toFixed(2)}</Text>
                </View>
              </View>

              {!item.approved ? (
                <>
                  <View style={styles.pendingRow}>
                    <Clock size={14} color={colors.warning} />
                    <Text style={styles.pendingTag}>ЧАКА ОДОБРЕНИЕ</Text>
                  </View>
                  <View style={styles.actionsRow}>
                    <Pressable style={[styles.actionButton, styles.approveButton]} disabled={busy} onPress={() => approve(item)}>
                      {busy ? (
                        <ActivityIndicator color={colors.onPrimary} size="small" />
                      ) : (
                        <>
                          <UserCheck size={16} color={colors.onPrimary} />
                          <Text style={styles.approveLabel}>Одобри</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, item.banned ? styles.unbanButton : styles.banButton]}
                      disabled={busy}
                      onPress={() => toggleBan(item)}
                    >
                      <Ban size={16} color={item.banned ? colors.text : '#ffffff'} />
                      <Text style={item.banned ? styles.unbanLabel : styles.banLabel}>
                        {item.banned ? 'Отбани' : 'Отхвърли'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.duesRow}>
                    <Text style={styles.duesLabel}>Дължи на платформата</Text>
                    <Text style={styles.duesValue}>{formatDualCurrency(item.owedBGN)}</Text>
                  </View>
                  <Text style={styles.duesMeta}>{item.unsettledRideCount} неразчетени пътувания · статус: {item.status}</Text>
                  {item.banned && <Text style={styles.bannedTag}>БАНИРАН</Text>}

                  <View style={styles.actionsRow}>
                    <Pressable
                      style={[styles.actionButton, styles.settleButton]}
                      disabled={busy || item.owedBGN <= 0}
                      onPress={() => confirmSettle(item)}
                    >
                      {busy ? (
                        <ActivityIndicator color={colors.onPrimary} size="small" />
                      ) : (
                        <>
                          <CheckCircle2 size={16} color={colors.onPrimary} />
                          <Text style={styles.settleLabel}>Платено</Text>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, item.banned ? styles.unbanButton : styles.banButton]}
                      disabled={busy}
                      onPress={() => toggleBan(item)}
                    >
                      <Ban size={16} color={item.banned ? colors.text : '#ffffff'} />
                      <Text style={item.banned ? styles.unbanLabel : styles.banLabel}>
                        {item.banned ? 'Отбани' : 'Бани'}
                      </Text>
                    </Pressable>
                  </View>
                </>
              )}
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
  cardPending: { borderWidth: 1, borderColor: colors.warning },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  carThumb: { width: 48, height: 48, borderRadius: 10 },
  carThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flexShrink: { flexShrink: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  duesRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  duesLabel: { color: colors.textMuted, fontSize: 13 },
  duesValue: { color: colors.primary, fontWeight: '800', fontSize: 18 },
  duesMeta: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  bannedTag: { color: colors.danger, fontWeight: '800', fontSize: 11, marginTop: 8, letterSpacing: 1 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  pendingTag: { color: colors.warning, fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 10,
  },
  settleButton: { backgroundColor: colors.primary },
  settleLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  approveButton: { backgroundColor: colors.primary },
  approveLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
  banButton: { backgroundColor: colors.danger },
  banLabel: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  unbanButton: { backgroundColor: colors.surface },
  unbanLabel: { color: colors.text, fontWeight: '700', fontSize: 13 },
});
