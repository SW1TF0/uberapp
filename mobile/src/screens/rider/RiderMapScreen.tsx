import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import database from '@react-native-firebase/database';
import { History, Search, User } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RiderStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { CITY_CENTER, DEFAULT_REGION } from '../../data/kardzhaliRegion';
import { useAuth } from '../../hooks/useAuth';
import { useRideDispatch } from '../../hooks/useRideDispatch';
import { LeafletMap } from '../../components/LeafletMap';
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
      <LeafletMap
        region={{
          latitude: myLocation.latitude,
          longitude: myLocation.longitude,
          latitudeDelta: DEFAULT_REGION.latitudeDelta,
          longitudeDelta: DEFAULT_REGION.longitudeDelta,
        }}
        markers={[{ id: 'me', lat: myLocation.latitude, lng: myLocation.longitude, color: colors.primary }]}
        driverMarkers={drivers.map((d) => ({ id: d.id, lat: d.location!.lat, lng: d.location!.lng }))}
      />

      <View style={styles.topBar}>
        <Text style={styles.greeting}>Здравей, {profile?.name?.split(' ')[0] || 'приятел'} 👋</Text>
        <View style={styles.topBarIcons}>
          <Pressable
            style={styles.iconButton}
            onPress={() => navigation.navigate('RideHistory')}
            accessibilityRole="button"
            accessibilityLabel="История на пътуванията"
          >
            <History size={20} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.iconButton}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Профил"
          >
            <User size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.sheet}>
        <Pressable
          style={styles.searchBar}
          onPress={() => navigation.navigate('DestinationPicker')}
          accessibilityRole="button"
          accessibilityLabel="Накъде отиваш? Избери дестинация"
        >
          <Search size={18} color={colors.textMuted} />
          <Text style={styles.searchPlaceholder}>Накъде отиваш?</Text>
        </Pressable>
        <View style={styles.driverCountRow}>
          <View style={[styles.dot, drivers.length > 0 && styles.dotActive]} />
          <Text style={styles.driverCount}>{drivers.length} шофьора онлайн в Кърджали</Text>
        </View>
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
    ...shadows.card,
  },
  topBarIcons: { flexDirection: 'row', gap: 10 },
  iconButton: { backgroundColor: colors.surface, padding: 10, borderRadius: 12, ...shadows.card },
  sheet: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    ...shadows.sheet,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
  },
  searchPlaceholder: { color: colors.textMuted, fontSize: 16 },
  driverCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted },
  dotActive: { backgroundColor: colors.primary },
  driverCount: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
});
