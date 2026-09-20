import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import database from '@react-native-firebase/database';
import { Star } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RiderStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { DEFAULT_REGION } from '../../data/kardzhaliRegion';
import { useRideDispatch } from '../../hooks/useRideDispatch';
import { fetchDirections } from '../../services/googleMaps';
import { DriverRecord } from '../../types/models';
import { AnimatedDriverMarker } from '../../components/AnimatedDriverMarker';

type Props = NativeStackScreenProps<RiderStackParamList, 'LiveTrip'>;

const STATUS_LABEL: Record<string, string> = {
  requested: 'Търсим ти шофьор...',
  accepted: 'Шофьорът е на път',
  arrived: 'Шофьорът те чака отпред',
  in_progress: 'Пътуването е в ход',
};

export default function LiveTripScreen({ navigation }: Props) {
  const { activeRide, cancelRide, rateRide } = useRideDispatch();
  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [rating, setRating] = useState(5);

  useEffect(() => {
    if (!activeRide?.driverId) {
      setDriver(null);
      return undefined;
    }
    const driverRef = database().ref(`/drivers/${activeRide.driverId}`);
    const listener = driverRef.on('value', (snap) => setDriver(snap.val() as DriverRecord));
    return () => driverRef.off('value', listener);
  }, [activeRide?.driverId]);

  useEffect(() => {
    if (!activeRide || !driver?.location) return;
    const target = activeRide.status === 'in_progress' ? activeRide.dropoff : activeRide.pickup;
    fetchDirections(driver.location, target).then((result) => {
      if (result) setRouteCoords(result.polyline.map((p) => ({ latitude: p.lat, longitude: p.lng })));
    });
  }, [activeRide?.status, driver?.location?.lat, driver?.location?.lng]);

  if (!activeRide) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Няма активно пътуване.</Text>
      </View>
    );
  }

  if (activeRide.status === 'cancelled') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Пътуването е отказано</Text>
        <Pressable style={styles.doneButton} onPress={() => navigation.replace('RiderMap')}>
          <Text style={styles.doneLabel}>Към картата</Text>
        </Pressable>
      </View>
    );
  }

  if (activeRide.status === 'completed') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Пристигна! 🎉</Text>
        <Text style={styles.fare}>{(activeRide.finalFareBGN ?? activeRide.fareEstimateBGN).toFixed(2)} лв</Text>
        <Text style={styles.sectionTitle}>Как беше пътуването?</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)}>
              <Star
                size={32}
                color={n <= rating ? colors.warning : colors.border}
                fill={n <= rating ? colors.warning : 'transparent'}
              />
            </Pressable>
          ))}
        </View>
        <Pressable
          style={styles.doneButton}
          onPress={async () => {
            await rateRide(activeRide.id, rating);
            navigation.replace('RiderMap');
          }}
        >
          <Text style={styles.doneLabel}>Готово</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <MapView style={styles.flex} provider={PROVIDER_DEFAULT} initialRegion={DEFAULT_REGION}>
        <Marker
          coordinate={{ latitude: activeRide.pickup.lat, longitude: activeRide.pickup.lng }}
          pinColor={colors.primary}
          title="Качване"
        />
        <Marker
          coordinate={{ latitude: activeRide.dropoff.lat, longitude: activeRide.dropoff.lng }}
          pinColor={colors.danger}
          title="Дестинация"
        />
        {driver?.location && (
          <AnimatedDriverMarker
            lat={driver.location.lat}
            lng={driver.location.lng}
            rotation={driver.location.heading ?? 0}
          />
        )}
        {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor={colors.primary} strokeWidth={4} />}
      </MapView>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{STATUS_LABEL[activeRide.status] || activeRide.status}</Text>
        {activeRide.status === 'requested' && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}

        {driver && activeRide.status !== 'requested' && (
          <View style={styles.driverCard}>
            <Text style={styles.driverName}>
              {driver.profile.name} · ★ {driver.profile.rating.toFixed(2)}
            </Text>
            <Text style={styles.driverVehicle}>
              {driver.profile.vehicle.color} {driver.profile.vehicle.make} {driver.profile.vehicle.model} ·{' '}
              {driver.profile.vehicle.plate}
            </Text>
          </View>
        )}
      </View>

      {['requested', 'accepted'].includes(activeRide.status) && (
        <Pressable style={styles.cancelButton} onPress={cancelRide}>
          <Text style={styles.cancelLabel}>Отказ</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 20 },
  emptyText: { color: colors.textMuted },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  fare: { color: colors.primary, fontSize: 22, fontWeight: '700', marginTop: 10 },
  sectionTitle: { color: colors.textMuted, marginTop: 24, marginBottom: 12 },
  stars: { flexDirection: 'row', gap: 8 },
  doneButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginTop: 30 },
  doneLabel: { color: colors.background, fontWeight: '700', fontSize: 16 },
  banner: { position: 'absolute', top: 56, left: 20, right: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  bannerTitle: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  driverCard: { marginTop: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  driverName: { color: colors.text, fontWeight: '600' },
  driverVehicle: { color: colors.textMuted, marginTop: 4 },
  cancelButton: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelLabel: { color: '#ffffff', fontWeight: '700' },
});
