import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import database from '@react-native-firebase/database';
import { Flag, Receipt as ReceiptIcon } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DriverStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { DEFAULT_REGION } from '../../data/kardzhaliRegion';
import { useAuth } from '../../hooks/useAuth';
import { useRideDispatch } from '../../hooks/useRideDispatch';
import { DirectionsResult, fetchDirections } from '../../services/freeMaps';
import { LeafletMap } from '../../components/LeafletMap';
import { ReportModal } from '../../components/ReportModal';
import { submitReport } from '../../services/admin';
import { shareReceipt } from '../../services/receipt';
import { formatDualCurrency } from '../../utils/currency';
import { GeoPoint } from '../../types/models';

type Props = NativeStackScreenProps<DriverStackParamList, 'DriverTrip'>;

export default function DriverTripScreen({ navigation }: Props) {
  const { firebaseUser, profile } = useAuth();
  const { activeRide, updateRideStatus, completeRide, clearActiveRide } = useRideDispatch();
  const [ownLocation, setOwnLocation] = useState<GeoPoint | null>(null);
  const [route, setRoute] = useState<DirectionsResult | null>(null);
  const [completing, setCompleting] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sharingReceipt, setSharingReceipt] = useState(false);

  async function handleShareReceipt() {
    if (!activeRide) return;
    setSharingReceipt(true);
    try {
      await shareReceipt(activeRide, { showEarnings: true, driverName: profile?.name });
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно генериране на разписката.');
    } finally {
      setSharingReceipt(false);
    }
  }

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
    fetchDirections(ownLocation, target).then(setRoute);
  }, [ownLocation?.lat, ownLocation?.lng, target?.lat, target?.lng]);

  async function finishTrip() {
    setCompleting(true);
    try {
      await completeRide();
    } finally {
      setCompleting(false);
    }
  }

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
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            clearActiveRide();
            navigation.replace('DriverDashboard');
          }}
        >
          <Text style={styles.primaryLabel}>Обратно към таблото</Text>
        </Pressable>
      </View>
    );
  }

  if (activeRide.status === 'completed') {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Пътуването приключи 🎉</Text>
        <Text style={styles.fare}>{formatDualCurrency(activeRide.finalFareBGN ?? activeRide.fareEstimateBGN)}</Text>
        <Text style={styles.paymentNote}>
          {activeRide.paymentMethod === 'cash'
            ? 'Плащане в брой — събрано от пътника'
            : activeRide.paymentStatus === 'paid'
            ? 'Платено с карта'
            : 'Чакаме пътникът да плати с карта'}
        </Text>
        {activeRide.driverEarningsBGN != null && (
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabel}>Такса на платформата (10%)</Text>
              <Text style={styles.earningsValue}>−{formatDualCurrency(activeRide.platformFeeBGN ?? 0)}</Text>
            </View>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsLabelBold}>Твоят приход</Text>
              <Text style={styles.earningsValueBold}>{formatDualCurrency(activeRide.driverEarningsBGN)}</Text>
            </View>
          </View>
        )}
        <Pressable style={styles.receiptButton} onPress={handleShareReceipt} disabled={sharingReceipt}>
          {sharingReceipt ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <ReceiptIcon size={16} color={colors.text} />
          )}
          <Text style={styles.receiptLabel}>Разписка</Text>
        </Pressable>
        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            clearActiveRide();
            navigation.replace('DriverDashboard');
          }}
        >
          <Text style={styles.primaryLabel}>Обратно към таблото</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <LeafletMap
        region={DEFAULT_REGION}
        markers={[
          { id: 'pickup', lat: activeRide.pickup.lat, lng: activeRide.pickup.lng, color: colors.primary },
          { id: 'dropoff', lat: activeRide.dropoff.lat, lng: activeRide.dropoff.lng, color: colors.danger },
        ]}
        driverMarkers={ownLocation ? [{ id: 'me', lat: ownLocation.lat, lng: ownLocation.lng }] : []}
        polyline={route?.polyline ?? []}
      />

      <View style={styles.banner}>
        <Pressable style={styles.reportIconButton} onPress={() => setReportOpen(true)}>
          <Flag size={16} color={colors.textMuted} />
        </Pressable>
        <Text style={styles.bannerTitle}>
          {activeRide.status === 'in_progress' ? 'Към дестинацията' : 'Към пътника'}
        </Text>
        {route && (
          <Text style={styles.bannerMeta}>
            {route.distanceKm} км · {route.durationMin} мин
          </Text>
        )}
      </View>

      <ReportModal
        visible={reportOpen}
        title="Докладвай пътника"
        onClose={() => setReportOpen(false)}
        onSubmit={(reason) =>
          submitReport(firebaseUser?.uid ?? '', 'driver', activeRide.riderId, activeRide.id, reason)
        }
      />

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
          <Pressable style={styles.primaryButton} onPress={finishTrip} disabled={completing}>
            <Text style={styles.primaryLabel}>
              {completing
                ? 'Завършва се...'
                : activeRide.paymentMethod === 'cash'
                ? 'Завърши и вземи в брой'
                : 'Завърши пътуването'}
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
  earningsCard: { backgroundColor: colors.card, borderRadius: 14, padding: 16, marginTop: 20, width: '100%' },
  earningsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  earningsLabel: { color: colors.textMuted, fontSize: 13 },
  earningsValue: { color: colors.textMuted, fontSize: 13 },
  earningsLabelBold: { color: colors.text, fontWeight: '700' },
  earningsValueBold: { color: colors.primary, fontWeight: '700' },
  receiptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
    ...shadows.card,
  },
  receiptLabel: { color: colors.text, fontWeight: '600', fontSize: 13 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    width: '100%',
  },
  primaryLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  banner: { position: 'absolute', top: 56, left: 20, right: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  bannerTitle: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  bannerMeta: { color: colors.textMuted, textAlign: 'center', marginTop: 6 },
  reportIconButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    borderRadius: 10,
    backgroundColor: colors.card,
    zIndex: 1,
  },
  actionBar: { position: 'absolute', bottom: 30, left: 20, right: 20 },
});
