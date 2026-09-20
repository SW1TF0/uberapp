import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import database from '@react-native-firebase/database';
import { Star } from 'lucide-react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RiderStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { DEFAULT_REGION } from '../../data/kardzhaliRegion';
import { useRideDispatch } from '../../hooks/useRideDispatch';
import { useRiderRideNotifications } from '../../hooks/useRideNotifications';
import { fetchDirections } from '../../services/freeMaps';
import { createCardPaymentIntent } from '../../services/payments';
import { formatDualCurrency } from '../../utils/currency';
import { DriverRecord, GeoPoint } from '../../types/models';
import { LeafletMap } from '../../components/LeafletMap';

type Props = NativeStackScreenProps<RiderStackParamList, 'LiveTrip'>;

const STATUS_LABEL: Record<string, string> = {
  requested: 'Търсим ти шофьор...',
  accepted: 'Шофьорът е на път',
  arrived: 'Шофьорът те чака отпред',
  in_progress: 'Пътуването е в ход',
};

export default function LiveTripScreen({ navigation }: Props) {
  const { activeRide, cancelRide, rateRide, clearActiveRide } = useRideDispatch();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  useRiderRideNotifications(activeRide);
  const [driver, setDriver] = useState<DriverRecord | null>(null);
  const [routeCoords, setRouteCoords] = useState<GeoPoint[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [payingCard, setPayingCard] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleCancel() {
    setCancelling(true);
    try {
      await cancelRide();
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешен отказ на пътуването.');
    } finally {
      setCancelling(false);
    }
  }

  async function handleCardPayment(rideId: string) {
    setPayingCard(true);
    try {
      const clientSecret = await createCardPaymentIntent(rideId);
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Kardzhali Ride',
      });
      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Грешка', presentError.message);
        }
        return;
      }
      // Stripe confirmed the charge on its end just now, but our own
      // record of it (paymentStatus) only updates once the stripeWebhook
      // Cloud Function processes the event — usually a second or two.
      // The live ride listener will flip this screen out of the payment
      // view automatically once that lands.
      setAwaitingConfirmation(true);
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно плащане.');
    } finally {
      setPayingCard(false);
    }
  }

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
      if (result) setRouteCoords(result.polyline);
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
        <Pressable
          style={styles.doneButton}
          onPress={() => {
            clearActiveRide();
            navigation.replace('RiderMap');
          }}
        >
          <Text style={styles.doneLabel}>Към картата</Text>
        </Pressable>
      </View>
    );
  }

  if (activeRide.status === 'completed') {
    const needsCardPayment = activeRide.paymentMethod === 'card' && activeRide.paymentStatus !== 'paid';

    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.centerScroll}>
          <Text style={styles.title}>Пристигна! 🎉</Text>
          <Text style={styles.fare}>{formatDualCurrency(activeRide.finalFareBGN ?? activeRide.fareEstimateBGN)}</Text>

          {driver && (
            <View style={styles.completedDriverRow}>
              {driver.profile.avatarUrl ? (
                <Image source={{ uri: driver.profile.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{driver.profile.name?.[0] ?? '?'}</Text>
                </View>
              )}
              <Text style={styles.completedDriverName}>{driver.profile.name}</Text>
            </View>
          )}

          {needsCardPayment ? (
            <>
              <Text style={styles.sectionTitle}>Плащане с карта</Text>
              {awaitingConfirmation ? (
                <View style={styles.pendingRow}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.hint}>Потвърждаваме плащането...</Text>
                </View>
              ) : (
                <Pressable
                  style={styles.doneButton}
                  disabled={payingCard}
                  onPress={() => handleCardPayment(activeRide.id)}
                >
                  {payingCard ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.doneLabel}>
                      Плати {formatDualCurrency(activeRide.finalFareBGN ?? activeRide.fareEstimateBGN)}
                    </Text>
                  )}
                </Pressable>
              )}
            </>
          ) : (
            <>
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

              <TextInput
                style={styles.reviewInput}
                placeholder="Остави отзив (по желание)"
                placeholderTextColor={colors.textMuted}
                value={reviewText}
                onChangeText={setReviewText}
                multiline
              />

              <Pressable
                style={styles.doneButton}
                disabled={submittingRating}
                onPress={async () => {
                  setSubmittingRating(true);
                  await rateRide(activeRide.id, rating, reviewText);
                  await clearActiveRide();
                  navigation.replace('RiderMap');
                }}
              >
                {submittingRating ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.doneLabel}>Готово</Text>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
        driverMarkers={driver?.location ? [{ id: 'driver', lat: driver.location.lat, lng: driver.location.lng }] : []}
        polyline={routeCoords}
      />

      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{STATUS_LABEL[activeRide.status] || activeRide.status}</Text>
        {activeRide.status === 'requested' && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}

        {driver && activeRide.status !== 'requested' && (
          <View style={[styles.driverCard, styles.driverCardRow]}>
            {driver.profile.avatarUrl ? (
              <Image source={{ uri: driver.profile.avatarUrl }} style={styles.smallAvatar} />
            ) : (
              <View style={styles.smallAvatarPlaceholder}>
                <Text style={styles.avatarInitial}>{driver.profile.name?.[0] ?? '?'}</Text>
              </View>
            )}
            <View style={styles.flexShrink}>
            <Text style={styles.driverName}>
              {driver.profile.name} · ★ {driver.profile.rating.toFixed(2)}
            </Text>
            <Text style={styles.driverVehicle}>
              {driver.profile.vehicle.color} {driver.profile.vehicle.make} {driver.profile.vehicle.model} ·{' '}
              {driver.profile.vehicle.plate}
            </Text>
            </View>
          </View>
        )}
      </View>

      {['requested', 'accepted'].includes(activeRide.status) && (
        <Pressable style={styles.cancelButton} onPress={handleCancel} disabled={cancelling}>
          {cancelling ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.cancelLabel}>Отказ</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 20 },
  centerScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  emptyText: { color: colors.textMuted },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  fare: { color: colors.primary, fontSize: 22, fontWeight: '700', marginTop: 10 },
  sectionTitle: { color: colors.textMuted, marginTop: 24, marginBottom: 12 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  hint: { color: colors.textMuted, fontSize: 13 },
  stars: { flexDirection: 'row', gap: 8 },
  reviewInput: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 20,
    width: '100%',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 24,
    alignItems: 'center',
  },
  doneLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  banner: { position: 'absolute', top: 56, left: 20, right: 20, backgroundColor: colors.surface, borderRadius: 16, padding: 16 },
  bannerTitle: { color: colors.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  driverCard: { marginTop: 12, backgroundColor: colors.card, borderRadius: 12, padding: 12 },
  driverCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flexShrink: { flexShrink: 1 },
  driverName: { color: colors.text, fontWeight: '600' },
  driverVehicle: { color: colors.textMuted, marginTop: 4 },
  completedDriverRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  completedDriverName: { color: colors.text, fontWeight: '600', fontSize: 15 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAvatar: { width: 36, height: 36, borderRadius: 18 },
  smallAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.text, fontWeight: '700' },
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
