import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';
import { formatDualCurrency } from '../../utils/currency';
import { fetchDriverCompletedRides, DriverReview } from '../../utils/reviews';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short' });
}

export default function DriverEarningsScreen() {
  const { firebaseUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalFees, setTotalFees] = useState(0);
  const [rideCount, setRideCount] = useState(0);
  const [rating, setRating] = useState({ average: 5, count: 0 });
  const [reviews, setReviews] = useState<DriverReview[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
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
        completed.forEach((r) => {
          earnings += r.driverEarningsBGN ?? 0;
          fees += r.platformFeeBGN ?? 0;
        });
        setTotalEarnings(Math.round(earnings * 100) / 100);
        setTotalFees(Math.round(fees * 100) / 100);
        setRideCount(completed.length);
      } finally {
        setLoading(false);
      }
    })();
  }, [firebaseUser]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Печалби и отзиви</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Твоите приходи (след 10% такса)</Text>
        <Text style={styles.summaryValue}>{formatDualCurrency(totalEarnings)}</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryMeta}>{rideCount} пътувания</Text>
          <Text style={styles.summaryMeta}>Такса на платформата: {formatDualCurrency(totalFees)}</Text>
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
        ListEmptyComponent={<Text style={styles.empty}>Все още няма писмени отзиви.</Text>}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 16 },
  summaryCard: { backgroundColor: colors.card, borderRadius: 16, padding: 18 },
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
  },
  ratingValue: { color: colors.text, fontWeight: '700', fontSize: 16 },
  ratingCount: { color: colors.textMuted, fontSize: 13 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 10 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 20 },
  reviewCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewDate: { color: colors.textMuted, fontSize: 12 },
  reviewText: { color: colors.text, marginTop: 8, fontSize: 14 },
});
