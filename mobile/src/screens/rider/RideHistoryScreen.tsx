import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList, StyleSheet, Alert } from 'react-native';
import database from '@react-native-firebase/database';
import { History, Receipt as ReceiptIcon, Star } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { useAuth } from '../../hooks/useAuth';
import { formatDualCurrency } from '../../utils/currency';
import { shareReceipt } from '../../services/receipt';
import { DriverRecord, Ride, VehicleType } from '../../types/models';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';

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
  const [sharingRideId, setSharingRideId] = useState<string | null>(null);

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

  async function handleShareReceipt(ride: Ride) {
    setSharingRideId(ride.id);
    try {
      let driverName: string | undefined;
      if (ride.driverId) {
        const snap = await database().ref(`/drivers/${ride.driverId}/profile`).once('value');
        driverName = (snap.val() as DriverRecord['profile'] | null)?.name;
      }
      await shareReceipt(ride, { driverName });
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно генериране на касовата бележка.');
    } finally {
      setSharingRideId(null);
    }
  }

  if (loading) {
    return <LoadingScreen label="Зареждане на пътуванията..." />;
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>История на пътуванията</Text>
      <FlatList
        data={rides}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<EmptyState icon={History} text="Все още нямаш пътувания." />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.route} numberOfLines={1}>
                {item.pickup.address || 'Начало'} → {item.dropoff.address || 'Дестинация'}
              </Text>
              <Text style={styles.price}>{formatDualCurrency(item.finalFareBGN ?? item.fareEstimateBGN)}</Text>
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
              {item.status === 'completed' && (
                <Pressable
                  style={styles.receiptButton}
                  onPress={() => handleShareReceipt(item)}
                  disabled={sharingRideId === item.id}
                >
                  {sharingRideId === item.id ? (
                    <ActivityIndicator size="small" color={colors.textMuted} />
                  ) : (
                    <ReceiptIcon size={14} color={colors.textMuted} />
                  )}
                </Pressable>
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
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  list: { paddingBottom: 24 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginBottom: 10, ...shadows.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  route: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  price: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  meta: { color: colors.textMuted, fontSize: 12, flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  receiptButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
});
