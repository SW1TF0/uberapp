import { useCallback, useEffect, useRef } from 'react';
import database from '@react-native-firebase/database';
import { useAuthStore } from '../store/authStore';
import { useRideStore } from '../store/rideStore';
import {
  DriverRideOffer,
  GeoPoint,
  PaymentMethod,
  PricingRules,
  Ride,
  RideStatus,
  VehicleType,
} from '../types/models';
import { estimateFare } from '../utils/fare';

const TERMINAL_STATUSES: RideStatus[] = ['completed', 'cancelled'];

// Single hook covering the full ride lifecycle for both roles:
//  - Rider: requestRide() / cancelRide(), and activeRide tracks status
//    changes live as the assigned Cloud Function + driver update it.
//  - Driver: incomingOffer is the fan-out node a matching Cloud Function
//    (Phase 5) writes under /driverRequests/{driverId}; acceptOffer /
//    declineOffer resolve it, updateRideStatus() drives the trip forward.
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

  // Rider: watch own rides for the most recent non-terminal one.
  useEffect(() => {
    if (!firebaseUser || profile?.role !== 'rider') return undefined;

    const ridesQuery = database().ref('/rides').orderByChild('riderId').equalTo(firebaseUser.uid);
    const listener = ridesQuery.on('value', (snapshot) => {
      let latestActive: Ride | null = null;
      snapshot.forEach((child) => {
        const ride: Ride = { id: child.key as string, ...(child.val() as Omit<Ride, 'id'>) };
        if (!TERMINAL_STATUSES.includes(ride.status)) {
          if (!latestActive || ride.requestedAt > latestActive.requestedAt) latestActive = ride;
        }
        return undefined;
      });
      setActiveRide(latestActive);
    });

    return () => ridesQuery.off('value', listener);
  }, [firebaseUser, profile?.role, setActiveRide]);

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

  // Driver: watch own rides for the currently assigned non-terminal one.
  useEffect(() => {
    if (!firebaseUser || profile?.role !== 'driver') return undefined;

    const ridesQuery = database().ref('/rides').orderByChild('driverId').equalTo(firebaseUser.uid);
    const listener = ridesQuery.on('value', (snapshot) => {
      let latestActive: Ride | null = null;
      snapshot.forEach((child) => {
        const ride: Ride = { id: child.key as string, ...(child.val() as Omit<Ride, 'id'>) };
        if (!TERMINAL_STATUSES.includes(ride.status)) {
          if (!latestActive || ride.requestedAt > latestActive.requestedAt) latestActive = ride;
        }
        return undefined;
      });
      setActiveRide(latestActive);
    });

    return () => ridesQuery.off('value', listener);
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
        requestedAt: Date.now(),
        acceptedAt: null,
        arrivedAt: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        rating: null,
      };
      await rideRef.set(ride);
      return rideRef.key as string;
    },
    [firebaseUser]
  );

  const cancelRide = useCallback(async (): Promise<void> => {
    const rideId = activeRideIdRef.current;
    if (!rideId) return;
    await database().ref(`/rides/${rideId}`).update({
      status: 'cancelled',
      cancelledAt: Date.now(),
    });
  }, []);

  const acceptOffer = useCallback(async (): Promise<void> => {
    if (!firebaseUser || !incomingOffer) return;
    const { rideId } = incomingOffer;
    await database().ref(`/rides/${rideId}`).update({
      driverId: firebaseUser.uid,
      status: 'accepted',
      acceptedAt: Date.now(),
    });
    await database().ref(`/driverRequests/${firebaseUser.uid}`).remove();
  }, [firebaseUser, incomingOffer]);

  const declineOffer = useCallback(async (): Promise<void> => {
    if (!firebaseUser) return;
    await database().ref(`/driverRequests/${firebaseUser.uid}`).remove();
  }, [firebaseUser]);

  const updateRideStatus = useCallback(
    async (status: RideStatus): Promise<void> => {
      const rideId = activeRideIdRef.current;
      if (!rideId) return;

      const timestampField: Partial<Record<RideStatus, keyof Ride>> = {
        arrived: 'arrivedAt',
        in_progress: 'startedAt',
        completed: 'completedAt',
      };

      const updates: Record<string, unknown> = { status };
      const field = timestampField[status];
      if (field) updates[field] = Date.now();

      // Optimistic final fare from the original estimate; Phase 5's Cloud
      // Function overwrites this with the fare computed from the actual
      // driven route once the trip closes out.
      if (status === 'completed' && activeRide) {
        updates.finalFareBGN = activeRide.fareEstimateBGN;
      }

      await database().ref(`/rides/${rideId}`).update(updates);
    },
    [activeRide]
  );

  const rateRide = useCallback(async (rideId: string, rating: number): Promise<void> => {
    await database().ref(`/rides/${rideId}`).update({ rating });
  }, []);

  return {
    activeRide,
    incomingOffer,
    requestRide,
    cancelRide,
    acceptOffer,
    declineOffer,
    updateRideStatus,
    rateRide,
  };
}
