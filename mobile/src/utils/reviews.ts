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

// A broad query like orderByChild('driverId').equalTo(driverId) against
// /rides would need read permission at the /rides root itself, which the
// security rules don't grant (that would let any signed-in user list
// every ride in the app, including other people's pickup/dropoff points
// and fares). /driverHistory/{driverId} is a denormalized index the
// driver already owns and can list directly — completeRide() in
// useRideDispatch.ts writes one entry per finished ride there — so this
// reads that index first, then fetches each ride directly by id (allowed,
// since the per-ride rule grants read to its own driverId).
export async function fetchDriverCompletedRides(driverId: string): Promise<Ride[]> {
  const historySnapshot = await database().ref(`/driverHistory/${driverId}`).once('value');
  if (!historySnapshot.exists()) return [];

  const rideIds: string[] = [];
  historySnapshot.forEach((child) => {
    rideIds.push(child.key as string);
    return undefined;
  });

  const rideSnapshots = await Promise.all(rideIds.map((rideId) => database().ref(`/rides/${rideId}`).once('value')));

  const rides: Ride[] = [];
  rideSnapshots.forEach((snap, i) => {
    if (snap.exists()) rides.push({ id: rideIds[i], ...(snap.val() as Omit<Ride, 'id'>) });
  });
  return rides;
}

// Ratings live only on the ride records the rider wrote them to (the
// security rules only let a rider write their own ride, not another
// user's /drivers/{driverId} node) — so a driver's aggregate rating is
// computed here from their own ride history rather than maintained as a
// running counter riders would need write access to update.
export async function computeDriverRatingStats(driverId: string): Promise<DriverRatingStats> {
  const rides = await fetchDriverCompletedRides(driverId);

  const reviews: DriverReview[] = rides
    .filter((ride) => ride.status === 'completed' && typeof ride.rating === 'number')
    .map((ride) => ({
      rideId: ride.id,
      rating: ride.rating as number,
      reviewText: ride.reviewText ?? null,
      completedAt: ride.completedAt ?? 0,
    }))
    .sort((a, b) => b.completedAt - a.completedAt);

  if (reviews.length === 0) return { average: 5, count: 0, reviews: [] };

  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return { average: Math.round(average * 100) / 100, count: reviews.length, reviews };
}
