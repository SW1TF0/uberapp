import { useCallback, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';

const LOCATION_TASK_NAME = 'kardzhali-ride-driver-location-task';
const FOREGROUND_INTERVAL_MS = 4000;
const MIN_DISPLACEMENT_M = 15;

async function writeDriverLocation(coords: Location.LocationObjectCoords): Promise<void> {
  const uid = auth().currentUser?.uid;
  if (!uid) return;
  await database()
    .ref(`/drivers/${uid}/location`)
    .set({
      lat: coords.latitude,
      lng: coords.longitude,
      heading: coords.heading ?? null,
      speed: coords.speed ?? null,
      updatedAt: database.ServerValue.TIMESTAMP,
    });
}

if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) return;
    const payload = data as { locations: Location.LocationObject[] } | undefined;
    const latest = payload?.locations?.[payload.locations.length - 1];
    if (latest) await writeDriverLocation(latest.coords);
  });
}

// Streams the signed-in driver's GPS position to
// /drivers/{driverId}/location every ~3-5s while `isOnline` is true, both
// in the foreground (watchPositionAsync) and, once background permission is
// granted, via a registered background task so tracking survives the app
// being backgrounded mid-trip.
export function useDriverLocation(isOnline: boolean): { error: string | null } {
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const errorRef = useRef<string | null>(null);

  const startForegroundTracking = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      errorRef.current = 'Location permission denied.';
      return;
    }

    watcherRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: FOREGROUND_INTERVAL_MS,
        distanceInterval: MIN_DISPLACEMENT_M,
      },
      (loc) => {
        writeDriverLocation(loc.coords).catch(() => undefined);
      }
    );
  }, []);

  const startBackgroundTracking = useCallback(async () => {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') return;

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (alreadyStarted) return;

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: FOREGROUND_INTERVAL_MS,
      distanceInterval: MIN_DISPLACEMENT_M,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Kardzhali Ride е активен',
        notificationBody: 'Споделяш местоположението си, докато си онлайн като шофьор.',
      },
    });
  }, []);

  const stopTracking = useCallback(async () => {
    watcherRef.current?.remove();
    watcherRef.current = null;
    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (alreadyStarted) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }, []);

  useEffect(() => {
    if (isOnline) {
      startForegroundTracking().catch((e) => {
        errorRef.current = e instanceof Error ? e.message : 'Failed to start location tracking.';
      });
      startBackgroundTracking().catch(() => undefined);
    } else {
      stopTracking().catch(() => undefined);
    }
    return () => {
      stopTracking().catch(() => undefined);
    };
  }, [isOnline, startForegroundTracking, startBackgroundTracking, stopTracking]);

  return { error: errorRef.current };
}
