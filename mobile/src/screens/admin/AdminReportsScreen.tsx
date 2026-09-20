import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Alert, RefreshControl } from 'react-native';
import database from '@react-native-firebase/database';
import { colors } from '../../theme/colors';
import { fetchAllReports } from '../../services/admin';
import { Report, UserProfile } from '../../types/models';

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
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Жалби</Text>
      <FlatList
        data={reports}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>Няма подадени жалби.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.parties}>
              {ROLE_LABEL[item.reporterRole]} {names[item.reporterId] ?? item.reporterId} → {names[item.reportedId] ?? item.reportedId}
            </Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  list: { paddingBottom: 24 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10 },
  parties: { color: colors.text, fontWeight: '700', fontSize: 14 },
  reason: { color: colors.text, marginTop: 8, fontSize: 14 },
  date: { color: colors.textMuted, fontSize: 11, marginTop: 8 },
});
