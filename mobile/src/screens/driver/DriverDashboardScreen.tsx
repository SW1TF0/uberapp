import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, Pressable, Alert } from 'react-native';
import database from '@react-native-firebase/database';
import { Clock, User, Wallet } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DriverStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { DEFAULT_REGION } from '../../data/kardzhaliRegion';
import { useAuth } from '../../hooks/useAuth';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useRideDispatch } from '../../hooks/useRideDispatch';
import { useDriverOfferNotifications } from '../../hooks/useRideNotifications';
import { IncomingRequestOverlay } from '../../components/IncomingRequestOverlay';
import { LeafletMap } from '../../components/LeafletMap';
import { computeDriverRatingStats } from '../../utils/reviews';
import { GeoPoint } from '../../types/models';

type Props = NativeStackScreenProps<DriverStackParamList, 'DriverDashboard'>;

export default function DriverDashboardScreen({ navigation }: Props) {
  const { profile, firebaseUser, signOut } = useAuth();
  const { activeRide, incomingOffer, acceptOffer, declineOffer } = useRideDispatch();
  useDriverOfferNotifications(incomingOffer);
  const [online, setOnline] = useState(false);
  const [approved, setApproved] = useState<boolean | null>(null);
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
      setApproved(record?.approved === true);
      if (record?.location) setOwnLocation(record.location);
    });
    return () => ref.off('value', listener);
  }, [firebaseUser]);

  useEffect(() => {
    if (hasActiveRide) navigation.navigate('DriverTrip');
  }, [hasActiveRide, navigation]);

  // Keep the publicly-shown rating/ratingCount fresh from this driver's
  // own ride history — riders can't write to another user's /drivers
  // node (the security rules only allow self-writes there), so the
  // aggregate has to be computed and self-written by the driver's own
  // client rather than by whoever leaves the rating.
  useEffect(() => {
    if (!firebaseUser) return;
    computeDriverRatingStats(firebaseUser.uid)
      .then((stats) => {
        if (stats.count === 0) return;
        return database().ref(`/drivers/${firebaseUser.uid}/profile`).update({
          rating: stats.average,
          ratingCount: stats.count,
        });
      })
      .catch(() => undefined);
  }, [firebaseUser]);

  async function toggleOnline(value: boolean) {
    if (!firebaseUser) return;
    await database()
      .ref(`/drivers/${firebaseUser.uid}/status`)
      .set(value ? 'online' : 'offline');
    setOnline(value);
  }

  // The offer can go stale between being shown and being accepted (the
  // rider cancelled, or another client raced this one) — the security
  // rules will simply reject that write, so fall back to declining
  // cleanly instead of leaving a broken offer on screen. If the decline
  // fallback ALSO fails, surface it rather than leaving the overlay stuck
  // with no feedback.
  async function respondAccept() {
    try {
      await acceptOffer();
    } catch {
      try {
        await declineOffer();
      } catch (e) {
        Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно приемане на пътуването.');
      }
    }
  }

  async function respondDecline() {
    try {
      await declineOffer();
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешен отказ на пътуването.');
    }
  }

  if (approved === false) {
    return (
      <View style={styles.pendingWrap}>
        <Clock size={56} color={colors.warning} />
        <Text style={styles.pendingTitle}>Чакаш одобрение</Text>
        <Text style={styles.pendingBody}>
          Профилът ти на шофьор все още не е одобрен от администратор. Ще можеш да излизаш онлайн и да получаваш
          заявки веднага щом бъде прегледан.
        </Text>
        <Pressable style={styles.pendingProfileButton} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.pendingProfileLabel}>Профил</Text>
        </Pressable>
        <Pressable style={styles.pendingSignOutButton} onPress={signOut}>
          <Text style={styles.pendingSignOutLabel}>Изход</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <LeafletMap
        region={DEFAULT_REGION}
        driverMarkers={ownLocation ? [{ id: 'me', lat: ownLocation.lat, lng: ownLocation.lng }] : []}
      />

      <View style={styles.topBar}>
        <View style={styles.statusPill}>
          <View style={[styles.dot, { backgroundColor: online ? colors.primary : colors.textMuted }]} />
          <Text style={styles.statusText}>{online ? 'Онлайн' : 'Офлайн'}</Text>
          <Switch value={online} onValueChange={toggleOnline} disabled={hasActiveRide} trackColor={{ true: colors.primary }} />
        </View>
        <View style={styles.topBarIcons}>
          <Pressable style={styles.iconButton} onPress={() => navigation.navigate('DriverEarnings')}>
            <Wallet size={20} color={colors.text} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => navigation.navigate('Profile')}>
            <User size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.driverName}>{profile?.name}</Text>
        <Text style={styles.driverHint}>
          {online ? 'Изчакваме заявки за пътувания...' : 'Включи се онлайн, за да получаваш заявки'}
        </Text>
      </View>

      {incomingOffer && (
        <IncomingRequestOverlay offer={incomingOffer} onAccept={respondAccept} onDecline={respondDecline} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pendingWrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  pendingTitle: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 20, textAlign: 'center' },
  pendingBody: { color: colors.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  pendingProfileButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 28,
  },
  pendingProfileLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  pendingSignOutButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 20 },
  pendingSignOutLabel: { color: colors.textMuted, fontWeight: '600' },
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
    ...shadows.card,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: colors.text, fontWeight: '600' },
  topBarIcons: { flexDirection: 'row', gap: 10 },
  iconButton: { backgroundColor: colors.surface, padding: 10, borderRadius: 12, ...shadows.card },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...shadows.card,
  },
  driverName: { color: colors.text, fontWeight: '700', fontSize: 16 },
  driverHint: { color: colors.textMuted, marginTop: 4, fontSize: 13, textAlign: 'center' },
});
