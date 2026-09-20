import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import MapView, { PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import database from '@react-native-firebase/database';
import { User } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RiderStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { CITY_CENTER, DEFAULT_REGION } from '../../data/kardzhaliRegion';
import { useAuth } from '../../hooks/useAuth';
import { useRideDispatch } from '../../hooks/useRideDispatch';
import { AnimatedDriverMarker } from '../../components/AnimatedDriverMarker';
import { DriverRecord } from '../../types/models';

type Props = NativeStackScreenProps<RiderStackParamList, 'RiderMap'>;
type OnlineDriver = DriverRecord & { id: string };

export default function RiderMapScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const { activeRide } = useRideDispatch();
  const [myLocation, setMyLocation] = useState(CITY_CENTER);
  const [drivers, setDrivers] = useState<OnlineDriver[]>([]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setMyLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

  useEffect(() => {
    const driversQuery = database().ref('/drivers').orderByChild('status').equalTo('online');
    const listener = driversQuery.on('value', (snapshot) => {
      const list: OnlineDriver[] = [];
      snapshot.forEach((child) => {
        const record = child.val() as DriverRecord;
        if (record.location) list.push({ id: child.key as string, ...record });
        return undefined;
      });
      setDrivers(list);
    });
    return () => driversQuery.off('value', listener);
  }, []);

  // Resume an in-flight ride (e.g. after the app was backgrounded) straight
  // into the live trip screen instead of showing the browsing map.
  useEffect(() => {
    if (activeRide && !['completed', 'cancelled'].includes(activeRide.status)) {
      navigation.navigate('LiveTrip');
    }
  }, [activeRide?.id, activeRide?.status, navigation]);

  return (
    <View style={styles.flex}>
      <MapView style={styles.flex} provider={PROVIDER_DEFAULT} initialRegion={DEFAULT_REGION}>
        {drivers.map((d) => (
          <AnimatedDriverMarker
            key={d.id}
            lat={d.location!.lat}
            lng={d.location!.lng}
            rotation={d.location!.heading ?? 0}
          />
        ))}
      </MapView>

      <View style={styles.topBar}>
        <Text style={styles.greeting}>Здравей, {profile?.name?.split(' ')[0] || 'приятел'} 👋</Text>
        <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Profile')}>
          <User size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <Pressable style={styles.searchBar} onPress={() => navigation.navigate('DestinationPicker')}>
          <Text style={styles.searchPlaceholder}>Накъде отиваш? · Where to?</Text>
        </Pressable>
        <Text style={styles.driverCount}>{drivers.length} шофьора онлайн в Кърджали</Text>
      </View>
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
  greeting: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  iconButton: { backgroundColor: colors.surface, padding: 10, borderRadius: 12 },
  sheet: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
  },
  searchBar: { backgroundColor: colors.card, borderRadius: 14, padding: 16 },
  searchPlaceholder: { color: colors.textMuted, fontSize: 16 },
  driverCount: { color: colors.textMuted, marginTop: 10, textAlign: 'center', fontSize: 13 },
});
