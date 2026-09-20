import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import database from '@react-native-firebase/database';
import { Star } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';
import { Ride, VehicleType } from '../../types/models';

const STATUS_LABEL: Record<string, string> = {
  completed: 'Завършено',
  cancelled: 'Отказано',
};

const VEHICLE_LABEL: Record<VehicleType, string> = {
  economy: 'KardzhaliGo',
  comfort: 'KardzhaliGo Comfort',
  xl: 'KardzhaliGo XL',
};

function formatDate(timestamp: number | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('bg-BG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function RideHistoryScreen() {
  const { firebaseUser } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return undefined;

    const historyRef = database().ref(`/riderHistory/${firebaseUser.uid}`);
    const listener = historyRef.on('value', async (snapshot) => {
      const rideIds: string[] = [];
      snapshot.forEach((child) => {
        rideIds.push(child.key as string);
        return undefined;
      });

      if (rideIds.length === 0) {
        setRides([]);
        setLoading(false);
        return;
      }

      const rideSnapshots = await Promise.all(
        rideIds.map((id) => database().ref(`/rides/${id}`).once('value'))
      );
      const loadedRides = rideSnapshots
        .filter((s) => s.exists())
        .map((s) => ({ id: s.key as string, ...(s.val() as Omit<Ride, 'id'>) }))
        .sort((a, b) => (b.completedAt ?? b.requestedAt) - (a.completedAt ?? a.requestedAt));

      setRides(loadedRides);
      setLoading(false);
    });

    return () => historyRef.off('value', listener);
  }, [firebaseUser]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>История на пътуванията</Text>
      <FlatList
        data={rides}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Все още нямаш пътувания.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.route} numberOfLines={1}>
                {item.pickup.address || 'Начало'} → {item.dropoff.address || 'Дестинация'}
              </Text>
              <Text style={styles.price}>{(item.finalFareBGN ?? item.fareEstimateBGN).toFixed(2)} лв</Text>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.meta}>
                {formatDate(item.completedAt ?? item.requestedAt)} · {VEHICLE_LABEL[item.vehicleType]} ·{' '}
                {STATUS_LABEL[item.status] ?? item.status}
              </Text>
              {!!item.rating && (
                <View style={styles.ratingRow}>
                  <Star size={13} color={colors.warning} fill={colors.warning} />
                  <Text style={styles.ratingText}>{item.rating}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  list: { paddingBottom: 24 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  route: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  price: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  meta: { color: colors.textMuted, fontSize: 12, flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
});
