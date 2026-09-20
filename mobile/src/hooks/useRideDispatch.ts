import { useCallback, useEffect, useRef } from 'react';
import database from '@react-native-firebase/database';
import { useAuthStore } from '../store/authStore';
import { useRideStore } from '../store/rideStore';
import {
  DriverRideOffer,
  DriverRecord,
  GeoPoint,
  PaymentMethod,
  PricingRules,
  Ride,
  VehicleType,
} from '../types/models';
import { estimateFare, fareFromDistance, haversineKm, isOutsideCityLimits } from '../utils/fare';
import { fetchDirections } from '../services/freeMaps';

const MATCH_RADIUS_KM = 5;
const OFFER_TIMEOUT_MS = 15000;
const RETRY_INTERVAL_MS = 3000;

// Subscribes to /activeRides/{uid} (a single rideId string, or absent)
// and mirrors whichever ride it points to live via a direct /rides/{id}
// read. Both reads stay within what the security rules grant a normal
// user without needing a blanket read on /rides or /activeRides itself.
function watchActiveRideId(uid: string, setActiveRide: (ride: Ride | null) => void): () => void {
  const pointerRef = database().ref(`/activeRides/${uid}`);
  let detachRideListener: (() => void) | null = null;

  const pointerListener = pointerRef.on('value', (pointerSnap) => {
    detachRideListener?.();
    detachRideListener = null;

    const rideId = pointerSnap.val() as string | null;
    if (!rideId) {
      setActiveRide(null);
      return;
    }

    const rideRef = database().ref(`/rides/${rideId}`);
    const rideListener = rideRef.on('value', (rideSnap) => {
      setActiveRide(rideSnap.exists() ? { id: rideId, ...(rideSnap.val() as Omit<Ride, 'id'>) } : null);
    });
    detachRideListener = () => rideRef.off('value', rideListener);
  });

  return () => {
    pointerRef.off('value', pointerListener);
    detachRideListener?.();
  };
}

// Finds the nearest online, not-yet-tried driver within MATCH_RADIUS_KM of
// the pickup point and writes a fan-out offer for them, mirroring what a
// server-side Cloud Function would normally do. Run entirely from the
// rider's own client — there is no backend here, since Cloud Functions
// need Firebase's paid Blaze plan and this app is built to run on the
// free Spark plan instead. The trade-off: matching only progresses while
// the rider's app is open, and a malicious client could in principle spam
// offers (the security rules only check that the offer's ride actually
// belongs to that rider).
async function attemptMatch(rideId: string, ride: Ride): Promise<void> {
  if (ride.status !== 'requested') return;

  const now = Date.now();
  if (ride.matching?.expiresAt && ride.matching.expiresAt > now) {
    // Still waiting on an outstanding offer to respond or time out.
    return;
  }

  const driversSnapshot = await database()
    .ref('/drivers')
    .orderByChild('status')
    .equalTo('online')
    .once('value');
  if (!driversSnapshot.exists()) return;

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

  if (candidates.length === 0) return;

  candidates.sort((a, b) => a.distanceKm - b.distanceKm);
  const chosen = candidates[0];

  const offeredAt = now;
  const expiresAt = now + OFFER_TIMEOUT_MS;

  await database().ref(`/driverRequests/${chosen.driverId}/${rideId}`).set({
    rideId,
    offeredAt,
    expiresAt,
    pickupDistanceKm: Math.round(chosen.distanceKm * 10) / 10,
    fareEstimateBGN: ride.fareEstimateBGN,
  });

  await database().ref(`/rides/${rideId}/matching`).set({
    offeredDriverId: chosen.driverId,
    offeredAt,
    expiresAt,
    excludedDriverIds: { ...excluded, [chosen.driverId]: true },
  });
}

// Single hook covering the full ride lifecycle for both roles:
//  - Rider: requestRide() / cancelRide(); activeRide tracks status changes
//    live, and a background effect below drives matching forward (no
//    server to do it).
//  - Driver: incomingOffer is the fan-out node written by that matching
//    effect; acceptOffer / declineOffer resolve it, updateRideStatus() and
//    completeRide() drive the trip forward.
export function useRideDispatch() {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const profile = useAuthStore((s) => s.profile);

  const activeRide = useRideStore((s) => s.activeRide);
  const incomingOffer = useRideStore((s) => s.incomingOffer);
  const setActiveRide = useRideStore((s) => s.setActiveRide);
  const setIncomingOffer = useRideStore((s) => s.setIncomingOffer);

  const activeRideIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeRideIdRef.current = activeRide?.id ?? null;
  }, [activeRide?.id]);

  // Rider: track /activeRides/{uid} (a single rideId, written by
  // requestRide/cancelRide/clearActiveRide below) and live-listen to that
  // one ride directly. A broad `orderByChild('riderId').equalTo(uid)`
  // query against /rides would need read permission at the /rides root
  // itself, which the security rules deliberately don't grant (that would
  // let any signed-in user list every ride in the app) — reading one ride
  // node the caller is actually party to is what the per-ride rule allows.
  useEffect(() => {
    if (!firebaseUser || profile?.role !== 'rider') return undefined;
    return watchActiveRideId(firebaseUser.uid, setActiveRide);
  }, [firebaseUser, profile?.role, setActiveRide]);

  // Rider: keep trying to match a 'requested' ride to a driver. Retries
  // immediately when `matching` changes (a decline clears it — see
  // declineOffer below) and on a 3s safety-net interval in case an offer
  // silently expires without a response.
  useEffect(() => {
    if (!activeRide || profile?.role !== 'rider') return undefined;
    if (activeRide.status !== 'requested') return undefined;

    attemptMatch(activeRide.id, activeRide).catch(() => undefined);
    const interval = setInterval(() => {
      attemptMatch(activeRide.id, activeRide).catch(() => undefined);
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeRide?.id, activeRide?.status, activeRide?.matching?.expiresAt, profile?.role]);

  // Driver: watch the assigned ride offer fan-out node.
  useEffect(() => {
    if (!firebaseUser || profile?.role !== 'driver') return undefined;

    const offerRef = database().ref(`/driverRequests/${firebaseUser.uid}`);
    const listener = offerRef.on('value', (snapshot) => {
      if (!snapshot.exists()) {
        setIncomingOffer(null);
        return;
      }
      let offer: DriverRideOffer | null = null;
      snapshot.forEach((child) => {
        offer = child.val() as DriverRideOffer;
        return true;
      });
      setIncomingOffer(offer);
    });

    return () => offerRef.off('value', listener);
  }, [firebaseUser, profile?.role, setIncomingOffer]);

  // Driver: same /activeRides/{uid} indirection, written by
  // acceptOffer/clearActiveRide below.
  useEffect(() => {
    if (!firebaseUser || profile?.role !== 'driver') return undefined;
    return watchActiveRideId(firebaseUser.uid, setActiveRide);
  }, [firebaseUser, profile?.role, setActiveRide]);

  const requestRide = useCallback(
    async (
      pickup: GeoPoint,
      dropoff: GeoPoint,
      vehicleType: VehicleType,
      paymentMethod: PaymentMethod
    ): Promise<string> => {
      if (!firebaseUser) throw new Error('Не си влязъл в профила си.');

      const pricingSnapshot = await database().ref('/pricing_rules').once('value');
      if (!pricingSnapshot.exists()) {
        throw new Error('Тарифите все още не са конфигурирани.');
      }
      const pricing = pricingSnapshot.val() as PricingRules;
      const estimate = estimateFare(pickup, dropoff, vehicleType, pricing);

      const rideRef = database().ref('/rides').push();
      const ride: Omit<Ride, 'id'> = {
        riderId: firebaseUser.uid,
        driverId: null,
        pickup,
        dropoff,
        vehicleType,
        paymentMethod,
        status: 'requested',
        distanceKm: estimate.distanceKm,
        durationMin: estimate.durationMin,
        isOuterZone: estimate.isOuterZone,
        fareEstimateBGN: estimate.fareBGN,
        finalFareBGN: null,
        platformFeeBGN: null,
        driverEarningsBGN: null,
        requestedAt: Date.now(),
        acceptedAt: null,
        arrivedAt: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        rating: null,
        reviewText: null,
      };
      await rideRef.set(ride);
      const rideId = rideRef.key as string;
      await database().ref(`/activeRides/${firebaseUser.uid}`).set(rideId);
      // Seed the store immediately instead of waiting for the live
      // listener's next snapshot — on a fresh RTDB connection that can lag
      // a couple of seconds, which left the rider looking at an empty
      // "no active ride" screen right after tapping confirm.
      setActiveRide({ id: rideId, ...ride });
      return rideId;
    },
    [firebaseUser, setActiveRide]
  );

  const cancelRide = useCallback(async (): Promise<void> => {
    const rideId = activeRideIdRef.current;
    if (!rideId || !activeRide) return;

    const offeredDriverId = activeRide.matching?.offeredDriverId;
    await database().ref(`/rides/${rideId}`).update({
      status: 'cancelled',
      cancelledAt: Date.now(),
    });
    if (offeredDriverId) {
      await database()
        .ref(`/driverRequests/${offeredDriverId}/${rideId}`)
        .remove()
        .catch(() => undefined);
    }
  }, [activeRide]);

  const acceptOffer = useCallback(async (): Promise<void> => {
    if (!firebaseUser || !incomingOffer) return;
    const { rideId } = incomingOffer;

    // The /rides write rule requires both the ride's CURRENT status to
    // still be 'requested' and the driver's OWN /drivers/{uid}/status to
    // read 'online' at evaluation time — so this can fail if the rider
    // cancelled or another client beat this one to accepting. Realtime
    // Database rules also evaluate `root` against the state the write
    // would produce, so flipping the driver to 'busy' in the SAME
    // multi-location update would make that check see 'busy' and reject
    // the write; do it as a second, separate call once the ride write has
    // already succeeded.
    await database().ref(`/rides/${rideId}`).update({
      driverId: firebaseUser.uid,
      status: 'accepted',
      acceptedAt: Date.now(),
    });
    await database().ref(`/driverRequests/${firebaseUser.uid}`).remove();
    await database().ref(`/drivers/${firebaseUser.uid}/status`).set('busy');
    await database().ref(`/activeRides/${firebaseUser.uid}`).set(rideId);

    // Same reasoning as requestRide(): seed the store from a direct read
    // right away rather than waiting on the live listener's next tick.
    const rideSnapshot = await database().ref(`/rides/${rideId}`).once('value');
    if (rideSnapshot.exists()) {
      setActiveRide({ id: rideId, ...(rideSnapshot.val() as Omit<Ride, 'id'>) });
    }
  }, [firebaseUser, incomingOffer, setActiveRide]);

  const declineOffer = useCallback(async (): Promise<void> => {
    if (!firebaseUser || !incomingOffer) return;
    const { rideId } = incomingOffer;
    await database().ref(`/driverRequests/${firebaseUser.uid}`).remove();
    // Only expire the offer — do NOT remove the whole `matching` node.
    // excludedDriverIds lives there too, and wiping the node along with
    // it erases the rider's memory of who already declined, so the very
    // next match attempt immediately re-offers this same driver again
    // (they're still the nearest one). Setting expiresAt into the past
    // clears attemptMatch's "still waiting" guard while leaving
    // excludedDriverIds (and this driver's id in it) intact.
    await database()
      .ref(`/rides/${rideId}/matching`)
      .update({ expiresAt: 0 })
      .catch(() => undefined);
  }, [firebaseUser, incomingOffer]);

  const updateRideStatus = useCallback(async (status: 'arrived' | 'in_progress'): Promise<void> => {
    const rideId = activeRideIdRef.current;
    if (!rideId) return;

    const timestampField: Record<'arrived' | 'in_progress', keyof Ride> = {
      arrived: 'arrivedAt',
      in_progress: 'startedAt',
    };
    await database().ref(`/rides/${rideId}`).update({
      status,
      [timestampField[status]]: Date.now(),
    });
  }, []);

  // Driver: closes out the trip. Recomputes the fare from the ACTUAL
  // driven route (via OSRM) rather than the upfront haversine estimate,
  // then logs the finished ride to /transactions + per-user history
  // indexes — this is the client-side stand-in for what the Phase 5
  // Cloud Functions (finalizeRideFare) do server-side; see firebase/functions
  // for that version, usable later if this project moves to the Blaze plan.
  const completeRide = useCallback(async (): Promise<void> => {
    if (!firebaseUser || !activeRide) return;
    const rideId = activeRide.id;

    const pricingSnapshot = await database().ref('/pricing_rules').once('value');
    if (!pricingSnapshot.exists()) return;
    const pricing = pricingSnapshot.val() as PricingRules;

    const route = await fetchDirections(activeRide.pickup, activeRide.dropoff);
    const distanceKm = route?.distanceKm ?? activeRide.distanceKm;
    const durationMin = route?.durationMin ?? activeRide.durationMin;
    const isOuterZone =
      isOutsideCityLimits(activeRide.pickup, pricing) || isOutsideCityLimits(activeRide.dropoff, pricing);
    const finalFareBGN = fareFromDistance(distanceKm, durationMin, activeRide.vehicleType, pricing, isOuterZone);
    const commissionRate = pricing.platformCommissionRate ?? 0.1;
    const platformFeeBGN = Math.round(finalFareBGN * commissionRate * 100) / 100;
    const driverEarningsBGN = Math.round((finalFareBGN - platformFeeBGN) * 100) / 100;
    const completedAt = Date.now();

    await database().ref(`/rides/${rideId}`).update({
      status: 'completed',
      completedAt,
      distanceKm,
      durationMin,
      isOuterZone,
      finalFareBGN,
      platformFeeBGN,
      driverEarningsBGN,
    });

    const transaction = {
      rideId,
      riderId: activeRide.riderId,
      driverId: firebaseUser.uid,
      vehicleType: activeRide.vehicleType,
      paymentMethod: activeRide.paymentMethod,
      distanceKm,
      durationMin,
      fareBGN: finalFareBGN,
      platformFeeBGN,
      driverEarningsBGN,
      currency: pricing.currency,
      completedAt,
    };

    await database()
      .ref()
      .update({
        [`/transactions/${rideId}`]: transaction,
        [`/riderHistory/${activeRide.riderId}/${rideId}`]: true,
        [`/driverHistory/${firebaseUser.uid}/${rideId}`]: true,
      });
  }, [firebaseUser, activeRide]);

  const rateRide = useCallback(async (rideId: string, rating: number, reviewText?: string): Promise<void> => {
    await database()
      .ref(`/rides/${rideId}`)
      .update({ rating, reviewText: reviewText?.trim() || null });
  }, []);

  // Called once the user is done looking at a finished ride's screen
  // (rated it, or acknowledged a cancellation) — drops the
  // /activeRides/{uid} pointer so the next requestRide()/acceptOffer()
  // starts clean and the map/dashboard stops treating the old ride as
  // current.
  const clearActiveRide = useCallback(async (): Promise<void> => {
    if (!firebaseUser) return;
    await database().ref(`/activeRides/${firebaseUser.uid}`).set(null);
    setActiveRide(null);
  }, [firebaseUser, setActiveRide]);

  return {
    activeRide,
    incomingOffer,
    requestRide,
    cancelRide,
    acceptOffer,
    declineOffer,
    updateRideStatus,
    completeRide,
    rateRide,
    clearActiveRide,
  };
}
