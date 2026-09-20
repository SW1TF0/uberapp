import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { colors } from '../theme/colors';
import { DriverRideOffer } from '../types/models';

const OFFER_TIMEOUT_SECONDS = 15;

type Props = {
  offer: DriverRideOffer;
  onAccept: () => void;
  onDecline: () => void;
};

export function IncomingRequestOverlay({ offer, onAccept, onDecline }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(OFFER_TIMEOUT_SECONDS);
  const declineRef = useRef(onDecline);
  declineRef.current = onDecline;

  useEffect(() => {
    setSecondsLeft(OFFER_TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          declineRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [offer.rideId]);

  const progress = secondsLeft / OFFER_TIMEOUT_SECONDS;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.wrap}>
        <View style={styles.card}>
          <View style={styles.timerTrack}>
            <View style={[styles.timerFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.timerLabel}>{secondsLeft}с за отговор</Text>

          <Text style={styles.title}>Ново пътуване!</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Разстояние до пътника</Text>
            <Text style={styles.rowValue}>{offer.pickupDistanceKm.toFixed(1)} км</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Очаквана печалба</Text>
            <Text style={styles.rowValuePrimary}>{offer.fareEstimateBGN.toFixed(2)} лв</Text>
          </View>

          <View style={styles.actions}>
            <Pressable style={[styles.actionButton, styles.declineButton]} onPress={onDecline}>
              <Text style={styles.declineLabel}>Откажи</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, styles.acceptButton]} onPress={onAccept}>
              <Text style={styles.acceptLabel}>Приеми</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  timerTrack: { height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, backgroundColor: colors.warning },
  timerLabel: { color: colors.textMuted, marginTop: 8, fontSize: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  rowLabel: { color: colors.textMuted },
  rowValue: { color: colors.text, fontWeight: '600' },
  rowValuePrimary: { color: colors.primary, fontWeight: '700', fontSize: 18 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 26 },
  actionButton: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  declineButton: { backgroundColor: colors.card },
  declineLabel: { color: colors.text, fontWeight: '700' },
  acceptButton: { backgroundColor: colors.primary },
  acceptLabel: { color: colors.background, fontWeight: '700' },
});
