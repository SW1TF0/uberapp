import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import database from '@react-native-firebase/database';
import { MessageSquare, Star } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { useAuth } from '../../hooks/useAuth';
import { formatDualCurrency } from '../../utils/currency';
import { fetchDriverCompletedRides, DriverReview } from '../../utils/reviews';
import { LoadingScreen } from '../../components/LoadingScreen';
import { EmptyState } from '../../components/EmptyState';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' });
}

export default function DriverEarningsScreen() {
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [rideCount, setRideCount] = useState(0);
  const [owedBGN, setOwedBGN] = useState(0);
  const [rating, setRating] = useState({ average: 5, count: 0 });
  const [reviews, setReviews] = useState<DriverReview[]>([]);

  useEffect(() => {
    if (!firebaseUser) return undefined;

    // Live-listen (not once) so this screen updates immediately when the
    // admin taps "Платено" in the admin panel — that just bumps
    // settledUpTo, which this recomputes owedBGN against.
    const settledRef = database().ref(`/drivers/${firebaseUser.uid}/settledUpTo`);
    const listener = settledRef.on('value', (snap) => {
      const settledUpTo = (snap.val() as number | null) ?? 0;

      (async () => {
        try {
          const rides = await fetchDriverCompletedRides(firebaseUser.uid);
          const completed = rides.filter((r) => r.status === 'completed');

          const ratedReviews: DriverReview[] = completed
            .filter((r) => typeof r.rating === 'number')
            .map((r) => ({
              rideId: r.id,
              rating: r.rating as number,
              reviewText: r.reviewText ?? null,
              completedAt: r.completedAt ?? 0,
            }))
            .sort((a, b) => b.completedAt - a.completedAt);

          const average =
            ratedReviews.length > 0
              ? Math.round((ratedReviews.reduce((sum, r) => sum + r.rating, 0) / ratedReviews.length) * 100) / 100
              : 5;
          setRating({ average, count: ratedReviews.length });
          setReviews(ratedReviews.filter((r) => !!r.reviewText));

          let earnings = 0;
          let fees = 0;
          let owed = 0;
          completed.forEach((r) => {
            earnings += r.driverEarningsBGN ?? 0;
            fees += r.platformFeeBGN ?? 0;
            if ((r.completedAt ?? 0) > settledUpTo) owed += r.platformFeeBGN ?? 0;
          });
          setTotalEarnings(Math.round(earnings * 100) / 100);
          setTotalFees(Math.round(fees * 100) / 100);
          setOwedBGN(Math.round(owed * 100) / 100);
          setRideCount(completed.length);
        } finally {
          setLoading(false);
        }
      })();
    });

    return () => settledRef.off('value', listener);
  }, [firebaseUser]);

  if (loading) {
    return <LoadingScreen label="Зареждане на приходите..." />;
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Печалби и отзиви</Text>

      <View style={[styles.duesCard, owedBGN <= 0 && styles.duesCardSettled]}>
        <Text style={styles.duesLabel}>{owedBGN > 0 ? 'Дължиш на платформата' : 'Нямаш дължими към платформата'}</Text>
        <Text style={[styles.duesValue, owedBGN <= 0 && styles.duesValueSettled]}>{formatDualCurrency(owedBGN)}</Text>
        {owedBGN > 0 && <Text style={styles.duesHint}>Плаща се извън приложението, при следващото разчитане с администратора.</Text>}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Общо приходи (след 10% такса, от всички пътувания)</Text>
        <Text style={styles.summaryValue}>{formatDualCurrency(totalEarnings)}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryMeta}>{rideCount} пътувания</Text>
          <Text style={styles.summaryMeta}>Общо такси: {formatDualCurrency(totalFees)}</Text>
        </View>
      </View>

      <View style={styles.ratingCard}>
        <Star size={18} color={colors.warning} fill={colors.warning} />
        <Text style={styles.ratingValue}>{rating.average.toFixed(2)}</Text>
        <Text style={styles.ratingCount}>({rating.count} оценки)</Text>
      </View>

      <Text style={styles.sectionTitle}>Отзиви</Text>
      <FlatList
        data={reviews}
        keyExtractor={(r) => r.rideId}
        ListEmptyComponent={<EmptyState icon={MessageSquare} text="Все още няма писмени отзиви." />}
        renderItem={({ item }) => (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={13}
                    color={n <= item.rating ? colors.warning : colors.border}
                    fill={n <= item.rating ? colors.warning : 'transparent'}
                  />
                ))}
              </View>
              <Text style={styles.reviewDate}>{formatDate(item.completedAt)}</Text>
            </View>
            <Text style={styles.reviewText}>{item.reviewText}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  duesCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: 12,
    ...shadows.card,
  },
  duesCardSettled: { borderColor: colors.border },
  duesLabel: { color: colors.textMuted, fontSize: 13 },
  duesValue: { color: colors.danger, fontSize: 24, fontWeight: '800', marginTop: 6 },
  duesValueSettled: { color: colors.text },
  duesHint: { color: colors.textMuted, fontSize: 11, marginTop: 8 },
  summaryCard: { backgroundColor: colors.card, borderRadius: 16, padding: 18, ...shadows.card },
  summaryLabel: { color: colors.textMuted, fontSize: 13 },
  summaryValue: { color: colors.primary, fontSize: 24, fontWeight: '800', marginTop: 6 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  summaryMeta: { color: colors.textMuted, fontSize: 12 },
  ratingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    ...shadows.card,
  },
  ratingValue: { color: colors.text, fontWeight: '700', fontSize: 16 },
  ratingCount: { color: colors.textMuted, fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  reviewCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, ...shadows.card },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewDate: { color: colors.textMuted, fontSize: 12 },
  reviewText: { color: colors.text, marginTop: 8, fontSize: 14 },
});
