import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import database from '@react-native-firebase/database';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DriverStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { DEFAULT_REGION } from '../../data/kardzhaliRegion';
import { useAuth } from '../../hooks/useAuth';
import { useRideDispatch } from '../../hooks/useRideDispatch';
import { DrivingEta, fetchDirections, fetchDrivingEta } from '../../services/googleMaps';
import { AnimatedDriverMarker } from '../../components/AnimatedDriverMarker';
import { GeoPoint } from '../../types/models';

type Props = NativeStackScreenProps<DriverStackParamList, 'DriverTrip'>;

export default function DriverTripScreen({ navigation }: Props) {
  const { firebaseUser } = useAuth();
  const { activeRide, updateRideStatus } = useRideDispatch();
  const [ownLocation, setOwnLocation] = useState<GeoPoint | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [eta, setEta] = useState<DrivingEta | null>(null);

  useEffect(() => {
    if (!firebaseUser) return undefined;
    const ref = database().ref(`/drivers/${firebaseUser.uid}/location`);
    const listener = ref.on('value', (snap) => {
      if (snap.exists()) setOwnLocation(snap.val() as GeoPoint);
    });
    return () => ref.off('value', listener);
  }, [firebaseUser]);

  const target: GeoPoint | null = activeRide
    ? activeRide.status === 'in_progress'
      ? activeRide.dropoff
      : activeRide.pickup
    : null;

  useEffect(() => {
    if (!ownLocation || !target) return;
    fetchDirections(ownLocation, target).then((result) => {
      if (result) setRouteCoords(result.polyline.map((p) => ({ latitude: p.lat, longitude: p.lng })));
    });
    fetchDrivingEta(ownLocation, target).then(setEta);
  }, [ownLocation?.lat, ownLocation?.lng, target?.lat, target?.lng]);

  // Free the driver back up once their own ride wraps up. This is a
  // self-write (auth.uid === driverId) so it's always allowed by the
  // security rules, unlike a rider trying to flip another user's status.
  useEffect(() => {
    if (!firebaseUser) return;
    if (activeRide && ['completed', 'cancelled'].includes(activeRide.status)) {
      database().ref(`/drivers/${firebaseUser.uid}/status`).set('online').catch(() => undefined);
    }
  }, [activeRide?.status, firebaseUser]);

  if (!activeRide) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Изчакваме пътуване...</Text>
      </View>
    );
  }

  if (activeRide.status === 'cancelled') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Пътникът отказа пътуването</Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.replace('DriverDashboard')}>
          <Text style={styles.primaryLabel}>Обратно към таблото</Text>
        </Pressable>
      </View>
    );
  }

  if (activeRide.status === 'completed') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Пътуването приключи 🎉</Text>
        <Text style={styles.fare}>{(activeRide.finalFareBGN ?? activeRide.fareEstimateBGN).toFixed(2)} лв</Text>
        <Text style={styles.paymentNote}>
          {activeRide.paymentMethod === 'cash' ? 'Плащане в брой — събрано от пътника' : 'Платено с карта'}
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => navigation.replace('DriverDashboard')}>
          <Text style={styles.primaryLabel}>Обратно към таблото</Text>
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
        {ownLocation && <AnimatedDriverMarker lat={ownLocation.lat} lng={ownLocation.lng} />}
        {routeCoords.length > 0 && <Polyline coordinates={routeCoords} strokeColor={colors.primary} strokeWidth={4} />}
      </MapView>

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>
          {activeRide.status === 'in_progress' ? 'Към дестинацията' : 'Към пътника'}
        </Text>
        {eta && (
          <Text style={styles.bannerMeta}>
            {eta.distanceKm} км · {eta.durationMin} мин
          </Text>
        )}
      </View>

      <View style={styles.actionBar}>
        {activeRide.status === 'accepted' && (
          <Pressable style={styles.primaryButton} onPress={() => updateRideStatus('arrived')}>
            <Text style={styles.primaryLabel}>Пристигнах на точката</Text>
          </Pressable>
        )}
        {activeRide.status === 'arrived' && (
          <Pressable style={styles.primaryButton} onPress={() => updateRideStatus('in_progress')}>
            <Text style={styles.primaryLabel}>Започни пътуването</Text>
          </Pressable>
        )}
        {activeRide.status === 'in_progress' && (
          <Pressable style={styles.primaryButton} onPress={() => updateRideStatus('completed')}>
            <Text style={styles.primaryLabel}>
              {activeRide.paymentMethod === 'cash' ? 'Завърши и вземи в брой' : 'Завърши пътуването'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 20 },
  emptyText: { color: colors.textMuted },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  fare: { color: colors.primary, fontSize: 24, fontWeight: '700', marginTop: 12 },
  paymentNote: { color: colors.textMuted, marginTop: 8 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  primaryLabel: { color: colors.background, fontWeight: '700', fontSize: 16 },
  banner: { position: 'absolute', top: 56, left: 20, right: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  bannerTitle: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  bannerMeta: { color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  actionBar: { position: 'absolute', bottom: 30, left: 20, right: 20 },
});
