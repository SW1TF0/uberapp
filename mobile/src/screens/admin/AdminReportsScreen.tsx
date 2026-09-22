import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, RefreshControl } from 'react-native';
import database from '@react-native-firebase/database';
import { Flag, ShieldAlert } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { fetchAllReports } from '../../services/admin';
import { Report, UserProfile } from '../../types/models';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';

const ROLE_LABEL: Record<string, string> = { rider: 'Клиент', driver: 'Шофьор' };

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('bg-BG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [reportRows, usersSnapshot] = await Promise.all([
        fetchAllReports(),
        database().ref('/users').once('value'),
      ]);
      const nameMap: Record<string, string> = {};
      usersSnapshot.forEach((child) => {
        const user = child.val() as UserProfile;
        nameMap[child.key as string] = user.name;
        return undefined;
      });
      setReports(reportRows);
      setNames(nameMap);
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно зареждане на жалбите.');
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

  if (loading) {
    return <LoadingScreen label="Зареждане на жалбите..." />;
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Жалби</Text>
      <FlatList
        data={reports}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState icon={ShieldAlert} text="Няма подадени жалби." />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.flagBadge}>
                <Flag size={14} color={colors.danger} />
              </View>
              <Text style={styles.parties}>
                {ROLE_LABEL[item.reporterRole]} {names[item.reporterId] ?? item.reporterId} →{' '}
                {names[item.reportedId] ?? item.reportedId}
              </Text>
            </View>
            <Text style={styles.reason}>{item.reason}</Text>
            <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 20 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  list: { paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10, ...shadows.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flagBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parties: { color: colors.text, fontWeight: '700', fontSize: 14, flexShrink: 1 },
  reason: { color: colors.text, marginTop: 10, fontSize: 14 },
  date: { color: colors.textMuted, fontSize: 11, marginTop: 8 },
});
