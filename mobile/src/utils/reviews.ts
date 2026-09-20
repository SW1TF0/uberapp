import database from '@react-native-firebase/database';
import { Ride } from '../types/models';

export type DriverReview = {
  rideId: string;
  rating: number;
  reviewText: string | null;
  completedAt: number;
};

export type DriverRatingStats = {
  average: number;
  count: number;
  reviews: DriverReview[];
};

// Ratings live only on the ride records the rider wrote them to (the
// security rules only let a rider write their own ride, not another
// user's /drivers/{driverId} node) — so a driver's aggregate rating is
// computed here from their own ride history rather than maintained as a
// running counter riders would need write access to update.
export async function computeDriverRatingStats(driverId: string): Promise<DriverRatingStats> {
  const snapshot = await database().ref('/rides').orderByChild('driverId').equalTo(driverId).once('value');
  if (!snapshot.exists()) return { average: 5, count: 0, reviews: [] };

  const reviews: DriverReview[] = [];
  snapshot.forEach((child) => {
    const ride = child.val() as Omit<Ride, 'id'>;
    if (ride.status === 'completed' && typeof ride.rating === 'number') {
      reviews.push({
        rideId: child.key as string,
        rating: ride.rating,
        reviewText: ride.reviewText ?? null,
        completedAt: ride.completedAt ?? 0,
      });
    }
    return undefined;
  });

  reviews.sort((a, b) => b.completedAt - a.completedAt);

  if (reviews.length === 0) return { average: 5, count: 0, reviews: [] };

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return { average: Math.round(average * 100) / 100, count: reviews.length, reviews };
}
