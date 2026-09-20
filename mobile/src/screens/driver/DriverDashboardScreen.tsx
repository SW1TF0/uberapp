import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, Pressable } from 'react-native';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import database from '@react-native-firebase/database';
import { User } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DriverStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { DEFAULT_REGION } from '../../data/kardzhaliRegion';
import { useAuth } from '../../hooks/useAuth';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useRideDispatch } from '../../hooks/useRideDispatch';
import { IncomingRequestOverlay } from '../../components/IncomingRequestOverlay';
import { AnimatedDriverMarker } from '../../components/AnimatedDriverMarker';
import { GeoPoint } from '../../types/models';

type Props = NativeStackScreenProps<DriverStackParamList, 'DriverDashboard'>;

export default function DriverDashboardScreen({ navigation }: Props) {
  const { profile, firebaseUser } = useAuth();
  const { activeRide, incomingOffer, acceptOffer, declineOffer } = useRideDispatch();
  const [online, setOnline] = useState(false);
  const [ownLocation, setOwnLocation] = useState<GeoPoint | null>(null);
  useDriverLocation(online);

  const hasActiveRide = !!activeRide && !['completed', 'cancelled'].includes(activeRide.status);

  useEffect(() => {
    if (!firebaseUser) return undefined;
    const ref = database().ref(`/drivers/${firebaseUser.uid}`);
    const listener = ref.on('value', (snap) => {
      const record = snap.val();
      // Treat 'busy' (mid-trip) as still toggled on for display purposes;
      // only 'offline' shows the switch as off.
      setOnline(record?.status ? record.status !== 'offline' : false);
      if (record?.location) setOwnLocation(record.location);
    });
    return () => ref.off('value', listener);
  }, [firebaseUser]);

  useEffect(() => {
    if (hasActiveRide) navigation.navigate('DriverTrip');
  }, [hasActiveRide, navigation]);

  async function toggleOnline(value: boolean) {
    if (!firebaseUser) return;
    await database()
      .ref(`/drivers/${firebaseUser.uid}/status`)
      .set(value ? 'online' : 'offline');
    setOnline(value);
  }

  return (
    <View style={styles.flex}>
      <MapView style={styles.flex} provider={PROVIDER_DEFAULT} initialRegion={DEFAULT_REGION}>
        {ownLocation && <AnimatedDriverMarker lat={ownLocation.lat} lng={ownLocation.lng} />}
      </MapView>

      <View style={styles.topBar}>
        <View style={styles.statusPill}>
          <View style={[styles.dot, { backgroundColor: online ? colors.primary : colors.textMuted }]} />
          <Text style={styles.statusText}>{online ? 'Онлайн' : 'Офлайн'}</Text>
          <Switch value={online} onValueChange={toggleOnline} disabled={hasActiveRide} trackColor={{ true: colors.primary }} />
        </View>
        <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Profile')}>
          <User size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.driverName}>{profile?.name}</Text>
        <Text style={styles.driverHint}>
          {online ? 'Изчакваме заявки за пътувания...' : 'Включи се онлайн, за да получаваш заявки'}
        </Text>
      </View>

      {incomingOffer && (
        <IncomingRequestOverlay offer={incomingOffer} onAccept={acceptOffer} onDecline={declineOffer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 56,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: colors.text, fontWeight: '600' },
  iconButton: { backgroundColor: colors.surface, padding: 10, borderRadius: 12 },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  driverName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  driverHint: { color: colors.textMuted, marginTop: 4, fontSize: 13, textAlign: 'center' },
});
