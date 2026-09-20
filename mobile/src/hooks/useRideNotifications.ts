import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore';
import { DriverRideOffer, Ride, RideStatus } from '../types/models';

// In-app notifications only — while the app is open or backgrounded but
// still running. There's no server here to trigger a real push while the
// app is fully closed (that needs the Cloud Functions + FCM upgrade path;
// see README.md).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let permissionRequested = false;

async function ensurePermission(): Promise<void> {
  if (permissionRequested) return;
  permissionRequested = true;
  await Notifications.requestPermissionsAsync().catch(() => undefined);
}

async function notify(title: string, body: string): Promise<void> {
  if (useAuthStore.getState().profile?.notificationsEnabled === false) return;
  await ensurePermission();
  await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null }).catch(() => undefined);
}

const RIDER_STATUS_MESSAGES: Partial<Record<RideStatus, { title: string; body: string }>> = {
  accepted: { title: 'Шофьор те намери!', body: 'Провери детайлите за пътуването.' },
  arrived: { title: 'Шофьорът пристигна', body: 'Той те чака на точката за качване.' },
  in_progress: { title: 'Пътуването започна', body: 'Приятно пътуване!' },
  completed: { title: 'Пристигна!', body: 'Оцени пътуването си.' },
  cancelled: { title: 'Пътуването е отказано', body: '' },
};

// Fires once per status change (never on the very first render, since
// that would just re-announce whatever state the ride already loaded in).
export function useRiderRideNotifications(ride: Ride | null): void {
  const lastStatus = useRef<string | null>(null);

  useEffect(() => {
    if (!ride) {
      lastStatus.current = null;
      return;
    }
    const isFirstObservation = lastStatus.current === null;
    const changed = lastStatus.current !== ride.status;
    lastStatus.current = ride.status;
    if (isFirstObservation || !changed) return;

    const message = RIDER_STATUS_MESSAGES[ride.status];
    if (message) notify(message.title, message.body);
  }, [ride?.status]);
}

export function useDriverOfferNotifications(offer: DriverRideOffer | null): void {
  const lastRideId = useRef<string | null>(null);

  useEffect(() => {
    if (!offer) {
      lastRideId.current = null;
      return;
    }
    if (lastRideId.current === offer.rideId) return;
    lastRideId.current = offer.rideId;
    notify('Ново пътуване!', `${offer.fareEstimateBGN.toFixed(2)} лв · ${offer.pickupDistanceKm.toFixed(1)} км`);
  }, [offer?.rideId]);
}
