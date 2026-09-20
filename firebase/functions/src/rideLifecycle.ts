import { onValueUpdated } from 'firebase-functions/v2/database';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { getDatabase } from 'firebase-admin/database';
import { fetchRouteDistance } from './lib/directions';
import { computeFare, isOutsideCityLimits, PricingRules, VehicleType } from './lib/fare';
import { GeoPoint } from './lib/geo';

// Server-side Directions key, separate from the client's
// EXPO_PUBLIC_GOOGLE_MAPS_API_KEY. Set with:
//   firebase functions:secrets:set GOOGLE_MAPS_SERVER_KEY
export const googleMapsServerKey = defineSecret('GOOGLE_MAPS_SERVER_KEY');

type MatchingState = {
  offeredDriverId?: string;
};

type RideRecord = {
  status: string;
  riderId: string;
  driverId: string | null;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  vehicleType: VehicleType;
  paymentMethod: 'cash' | 'card';
  distanceKm: number;
  durationMin: number;
  fareEstimateBGN: number;
  finalFareBGN: number | null;
  completedAt: number | null;
  matching?: MatchingState;
};

// Recomputes the fare from the ACTUAL driven route (Directions API), not
// the straight-line estimate the client showed up front, and logs the
// finished ride to /transactions + per-user history indexes.
export const finalizeRideFare = onValueUpdated(
  { ref: '/rides/{rideId}', secrets: [googleMapsServerKey] },
  async (event) => {
    const before = event.data.before.val() as RideRecord;
    const after = event.data.after.val() as RideRecord;

    if (before.status === 'completed' || after.status !== 'completed') return;

    const rideId = event.params.rideId;
    const db = getDatabase();

    const pricingSnapshot = await db.ref('/pricing_rules').get();
    if (!pricingSnapshot.exists()) {
      logger.error(`No /pricing_rules configured; cannot finalize fare for ride ${rideId}`);
      return;
    }
    const pricing = pricingSnapshot.val() as PricingRules;

    const apiKey = googleMapsServerKey.value();
    const route = await fetchRouteDistance(after.pickup, after.dropoff, apiKey);

    // Fall back to the client's haversine-based estimate if the Directions
    // call fails or no server key is configured, so a finished trip is
    // never left without a final fare.
    const distanceKm = route?.distanceKm ?? after.distanceKm;
    const durationMin = route?.durationMin ?? after.durationMin;
    const isOuterZone =
      isOutsideCityLimits(after.pickup, pricing) || isOutsideCityLimits(after.dropoff, pricing);
    const finalFareBGN = computeFare(distanceKm, durationMin, after.vehicleType, pricing, isOuterZone);
    const completedAt = after.completedAt ?? Date.now();

    await db.ref(`/rides/${rideId}`).update({
      distanceKm,
      durationMin,
      isOuterZone,
      finalFareBGN,
    });

    const transaction = {
      rideId,
      riderId: after.riderId,
      driverId: after.driverId,
      vehicleType: after.vehicleType,
      paymentMethod: after.paymentMethod,
      distanceKm,
      durationMin,
      fareBGN: finalFareBGN,
      currency: pricing.currency,
      completedAt,
    };

    const updates: Record<string, unknown> = {
      [`/transactions/${rideId}`]: transaction,
      [`/riderHistory/${after.riderId}/${rideId}`]: true,
    };
    if (after.driverId) updates[`/driverHistory/${after.driverId}/${rideId}`] = true;

    await db.ref().update(updates);

    logger.info(`Finalized fare for ride ${rideId}: ${finalFareBGN} ${pricing.currency}`);
  }
);

// A rider can only write their own ride's status to 'cancelled' — they
// can't touch another user's /driverRequests or /drivers node under the
// security rules. This does that cleanup server-side with Admin
// privileges: withdraw any outstanding offer and free the assigned driver.
export const onRideCancelled = onValueUpdated('/rides/{rideId}', async (event) => {
  const before = event.data.before.val() as RideRecord;
  const after = event.data.after.val() as RideRecord;

  if (before.status === 'cancelled' || after.status !== 'cancelled') return;

  const db = getDatabase();
  const updates: Record<string, unknown> = {};

  const offeredDriverId = after.matching?.offeredDriverId;
  if (offeredDriverId) {
    updates[`/driverRequests/${offeredDriverId}/${event.params.rideId}`] = null;
  }
  if (after.driverId) {
    updates[`/drivers/${after.driverId}/status`] = 'online';
  }

  if (Object.keys(updates).length > 0) {
    await db.ref().update(updates);
    logger.info(`Cleaned up after cancellation of ride ${event.params.rideId}`);
  }
});
