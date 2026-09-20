import { onValueCreated, onValueDeleted } from 'firebase-functions/v2/database';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { getDatabase } from 'firebase-admin/database';
import { GeoPoint, haversineKm } from './lib/geo';

const MATCH_RADIUS_KM = 5;
const OFFER_TIMEOUT_MS = 15000;

type DriverRecord = {
  status: 'offline' | 'online' | 'busy';
  location?: { lat: number; lng: number };
};

type MatchingState = {
  offeredDriverId?: string;
  offeredAt?: number;
  expiresAt?: number;
  excludedDriverIds?: Record<string, boolean>;
};

type RideRecord = {
  status: string;
  riderId: string;
  driverId: string | null;
  pickup: GeoPoint;
  fareEstimateBGN: number;
  matching?: MatchingState;
};

// Finds the nearest online, not-yet-tried driver within MATCH_RADIUS_KM of
// the pickup point and writes a fan-out offer for them. Called on ride
// creation, on a 1-minute scheduler sweep (in case an offer silently
// expires), and immediately when a driver declines (so the rider doesn't
// wait for the next sweep).
async function attemptMatch(rideId: string, ride: RideRecord, opts: { force?: boolean } = {}): Promise<void> {
  if (ride.status !== 'requested') return;

  const now = Date.now();
  if (!opts.force && ride.matching?.expiresAt && ride.matching.expiresAt > now) {
    // Still waiting on an outstanding offer to respond or time out.
    return;
  }

  const db = getDatabase();
  const driversSnapshot = await db.ref('/drivers').orderByChild('status').equalTo('online').get();
  if (!driversSnapshot.exists()) {
    logger.info(`No online drivers at all for ride ${rideId}`);
    return;
  }

  const excluded = ride.matching?.excludedDriverIds ?? {};
  const candidates: { driverId: string; distanceKm: number }[] = [];

  driversSnapshot.forEach((child) => {
    const driverId = child.key as string;
    if (excluded[driverId]) return undefined;
    const driver = child.val() as DriverRecord;
    if (!driver.location) return undefined;

    const distanceKm = haversineKm(driver.location, ride.pickup);
    if (distanceKm <= MATCH_RADIUS_KM) candidates.push({ driverId, distanceKm });
    return undefined;
  });

  if (candidates.length === 0) {
    logger.info(`No available drivers within ${MATCH_RADIUS_KM}km for ride ${rideId}`);
    return;
  }

  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  const chosen = candidates[0];

  const offeredAt = now;
  const expiresAt = now + OFFER_TIMEOUT_MS;

  await db.ref(`/driverRequests/${chosen.driverId}/${rideId}`).set({
    rideId,
    offeredAt,
    expiresAt,
    pickupDistanceKm: Math.round(chosen.distanceKm * 10) / 10,
    fareEstimateBGN: ride.fareEstimateBGN,
  });

  await db.ref(`/rides/${rideId}/matching`).set({
    offeredDriverId: chosen.driverId,
    offeredAt,
    expiresAt,
    excludedDriverIds: { ...excluded, [chosen.driverId]: true },
  });

  logger.info(`Offered ride ${rideId} to driver ${chosen.driverId} (${chosen.distanceKm}km away)`);
}

export const matchRideRequest = onValueCreated('/rides/{rideId}', async (event) => {
  const ride = event.data.val() as RideRecord;
  await attemptMatch(event.params.rideId, ride);
});

// Cloud Scheduler heartbeat: catches offers that expired without the
// driver's app calling accept/decline at all (e.g. it lost connectivity).
export const retryUnmatchedRides = onSchedule('every 1 minutes', async () => {
  const db = getDatabase();
  const snapshot = await db.ref('/rides').orderByChild('status').equalTo('requested').get();
  if (!snapshot.exists()) return;

  const jobs: Promise<void>[] = [];
  snapshot.forEach((child) => {
    const rideId = child.key as string;
    const ride = child.val() as RideRecord;
    jobs.push(attemptMatch(rideId, ride));
    return undefined;
  });
  await Promise.all(jobs);
});

// Fires whenever a driver's fan-out offer node is removed — by an explicit
// decline, or by acceptOffer() clearing it after accepting. The guard below
// tells the two apart (an accepted ride already has status 'accepted' and a
// driverId by the time the node is removed) and only re-matches on decline,
// immediately rather than waiting up to a minute for the next sweep.
export const onOfferRemoved = onValueDeleted('/driverRequests/{driverId}/{rideId}', async (event) => {
  const { rideId } = event.params;
  const db = getDatabase();

  const rideSnapshot = await db.ref(`/rides/${rideId}`).get();
  if (!rideSnapshot.exists()) return;

  const ride = rideSnapshot.val() as RideRecord;
  if (ride.status !== 'requested' || ride.driverId) return;

  await attemptMatch(rideId, ride, { force: true });
});
