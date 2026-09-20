import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';
import { formatDualCurrency } from '../../utils/currency';
import { computeDriverRatingStats, DriverReview } from '../../utils/reviews';
import database from '@react-native-firebase/database';
import { Ride } from '../../types/models';

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
      const stats = await computeDriverRatingStats(firebaseUser.uid);
      setRating({ average: stats.average, count: stats.count });
      setReviews(stats.reviews.filter((r) => !!r.reviewText));

      const snapshot = await database()
        .ref('/rides')
        .orderByChild('driverId')
        .equalTo(firebaseUser.uid)
        .once('value');

      let earnings = 0;
      let fees = 0;
      let count = 0;
      snapshot.forEach((child) => {
        const ride = child.val() as Omit<Ride, 'id'>;
        if (ride.status === 'completed') {
          earnings += ride.driverEarningsBGN ?? 0;
          fees += ride.platformFeeBGN ?? 0;
          count += 1;
        }
        return undefined;
      });
      setTotalEarnings(Math.round(earnings * 100) / 100);
      setTotalFees(Math.round(fees * 100) / 100);
      setRideCount(count);
      setLoading(false);
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
