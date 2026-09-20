import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import database from '@react-native-firebase/database';
import { ArrowLeft, Banknote, CreditCard } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RiderStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { useRideDispatch } from '../../hooks/useRideDispatch';
import { estimateFare } from '../../utils/fare';
import { formatDualCurrency } from '../../utils/currency';
import { PaymentMethod, PricingRules, VehicleType } from '../../types/models';

type Props = NativeStackScreenProps<RiderStackParamList, 'RideConfirm'>;

const VEHICLE_LABELS: Record<VehicleType, string> = {
  economy: 'KardzhaliGo',
  comfort: 'KardzhaliGo Comfort',
  xl: 'KardzhaliGo XL',
};

export default function RideConfirmScreen({ route, navigation }: Props) {
  const { pickup, dropoff } = route.params;
  const { requestRide } = useRideDispatch();
  const [pricing, setPricing] = useState<PricingRules | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>('economy');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    database()
      .ref('/pricing_rules')
      .once('value')
      .then((snap) => {
        if (snap.exists()) setPricing(snap.val() as PricingRules);
      });
  }, []);

  if (!pricing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const estimates = (['economy', 'comfort', 'xl'] as VehicleType[]).map((type) => ({
    type,
    ...estimateFare(pickup, dropoff, type, pricing),
  }));
  const selected = estimates.find((e) => e.type === vehicleType)!;

  async function confirm() {
    setSubmitting(true);
    setError('');
    try {
      await requestRide(pickup, dropoff, vehicleType, paymentMethod);
      navigation.replace('LiveTrip');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неуспешна заявка. Опитай пак.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
        <ArrowLeft size={20} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>
        {pickup.address || 'Начало'} → {dropoff.address || 'Дестинация'}
      </Text>
      {selected.isOuterZone && (
        <Text style={styles.surchargeNote}>Извън градските граници · надбавка за отдалечен район</Text>
      )}

      <View style={styles.vehicleList}>
        {estimates.map((e) => (
          <Pressable
            key={e.type}
            style={[styles.vehicleOption, vehicleType === e.type && styles.vehicleOptionSelected]}
            onPress={() => setVehicleType(e.type)}
          >
            <View>
              <Text style={styles.vehicleLabel}>{VEHICLE_LABELS[e.type]}</Text>
              <Text style={styles.vehicleMeta}>
                {e.distanceKm} км · {e.durationMin} мин
              </Text>
            </View>
            <Text style={styles.vehiclePrice}>{formatDualCurrency(e.fareBGN)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Начин на плащане</Text>
      <View style={styles.paymentRow}>
        <Pressable
          style={[styles.paymentOption, paymentMethod === 'cash' && styles.paymentOptionSelected]}
          onPress={() => setPaymentMethod('cash')}
        >
          <Banknote size={20} color={paymentMethod === 'cash' ? colors.onPrimary : colors.text} />
          <Text style={[styles.paymentLabel, paymentMethod === 'cash' && styles.paymentLabelSelected]}>
            В брой
          </Text>
        </Pressable>
        <Pressable
          style={[styles.paymentOption, paymentMethod === 'card' && styles.paymentOptionSelected]}
          onPress={() => setPaymentMethod('card')}
        >
          <CreditCard size={20} color={paymentMethod === 'card' ? colors.onPrimary : colors.text} />
          <Text style={[styles.paymentLabel, paymentMethod === 'card' && styles.paymentLabelSelected]}>
            Карта
          </Text>
        </Pressable>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.confirmButton} onPress={confirm} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.confirmLabel}>Поръчай · {formatDualCurrency(selected.fareBGN)}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  backButton: {
    backgroundColor: colors.card,
    padding: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  surchargeNote: { color: colors.warning, fontSize: 12, marginBottom: 16 },
  vehicleList: { marginTop: 12 },
  vehicleOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vehicleOptionSelected: { borderColor: colors.primary },
  vehicleLabel: { color: colors.text, fontSize: 16, fontWeight: '600' },
  vehicleMeta: { color: colors.textMuted, marginTop: 4 },
  vehiclePrice: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  sectionTitle: { color: colors.textMuted, marginTop: 8, marginBottom: 10 },
  paymentRow: { flexDirection: 'row', gap: 12 },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 14,
  },
  paymentOptionSelected: { backgroundColor: colors.primary },
  paymentLabel: { color: colors.text, fontWeight: '600' },
  paymentLabelSelected: { color: colors.onPrimary },
  error: { color: colors.danger, marginTop: 16, textAlign: 'center' },
  confirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  confirmLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
});
