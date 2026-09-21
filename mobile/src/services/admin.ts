import database from '@react-native-firebase/database';
import { DriverRecord, DriverVehicle, DriverStatus, Report, Role, UserProfile } from '../types/models';
import { fetchDriverCompletedRides } from '../utils/reviews';

export type AdminDriverRow = {
  uid: string;
  name: string;
  phone: string;
  email: string;
  vehicle: DriverVehicle;
  carPhotoUrl?: string;
  rating: number;
  status: DriverStatus;
  banned: boolean;
  approved: boolean;
  owedBGN: number;
  unsettledRideCount: number;
};

// Every call here relies on database.rules.json granting the signed-in
// user's own auth.token.email (must be ADMIN_EMAIL) broad read access to
// /users, /drivers, /driverHistory/*, /rides/* and /reports — a non-admin
// calling these just gets permission-denied, same as any other user.

export async function fetchAllDriversWithDues(): Promise<AdminDriverRow[]> {
  const [driversSnapshot, usersSnapshot] = await Promise.all([
    database().ref('/drivers').once('value'),
    database().ref('/users').once('value'),
  ]);

  const usersById = new Map<string, UserProfile>();
  usersSnapshot.forEach((child) => {
    usersById.set(child.key as string, child.val() as UserProfile);
    return undefined;
  });

  const driverIds: string[] = [];
  const drivers: Record<string, DriverRecord> = {};
  driversSnapshot.forEach((child) => {
    const uid = child.key as string;
    driverIds.push(uid);
    drivers[uid] = child.val() as DriverRecord;
    return undefined;
  });

  const rows = await Promise.all(
    driverIds.map(async (uid): Promise<AdminDriverRow> => {
      const driver = drivers[uid];
      const user = usersById.get(uid);
      const settledUpTo = driver.settledUpTo ?? 0;

      const rides = await fetchDriverCompletedRides(uid);
      const unsettled = rides.filter((r) => r.status === 'completed' && (r.completedAt ?? 0) > settledUpTo);
      const owedBGN = Math.round(unsettled.reduce((sum, r) => sum + (r.platformFeeBGN ?? 0), 0) * 100) / 100;

      return {
        uid,
        name: driver.profile?.name ?? user?.name ?? '?',
        phone: driver.profile?.phone ?? user?.phone ?? '',
        email: user?.email ?? '',
        vehicle: driver.profile?.vehicle,
        carPhotoUrl: driver.profile?.carPhotoUrl,
        rating: driver.profile?.rating ?? 5,
        status: driver.status,
        banned: user?.banned === true,
        approved: driver.approved === true,
        owedBGN,
        unsettledRideCount: unsettled.length,
      };
    })
  );

  // Drivers waiting on approval float to the top — that's the queue an
  // admin needs to clear first — then the rest sort by amount owed.
  return rows.sort((a, b) => {
    if (a.approved !== b.approved) return a.approved ? 1 : -1;
    return b.owedBGN - a.owedBGN;
  });
}

export async function fetchAllClients(): Promise<UserProfile[]> {
  const snapshot = await database().ref('/users').once('value');
  const clients: UserProfile[] = [];
  snapshot.forEach((child) => {
    const user = child.val() as UserProfile;
    if (user.role === 'rider') clients.push(user);
    return undefined;
  });
  return clients.sort((a, b) => b.createdAt - a.createdAt);
}

export async function setUserBanned(uid: string, banned: boolean): Promise<void> {
  await database().ref(`/users/${uid}/banned`).set(banned);
}

export async function markDriverSettled(driverId: string): Promise<void> {
  await database().ref(`/drivers/${driverId}/settledUpTo`).set(Date.now());
}

export async function setDriverApproved(driverId: string, approved: boolean): Promise<void> {
  await database().ref(`/drivers/${driverId}/approved`).set(approved);
}

export async function fetchAllReports(): Promise<Report[]> {
  const snapshot = await database().ref('/reports').once('value');
  const reports: Report[] = [];
  snapshot.forEach((child) => {
    reports.push({ id: child.key as string, ...(child.val() as Omit<Report, 'id'>) });
    return undefined;
  });
  return reports.sort((a, b) => b.createdAt - a.createdAt);
}

export async function submitReport(
  reporterId: string,
  reporterRole: Role,
  reportedId: string,
  rideId: string | null,
  reason: string
): Promise<void> {
  const ref = database().ref('/reports').push();
  await ref.set({
    reporterId,
    reporterRole,
    reportedId,
    rideId,
    reason: reason.trim(),
    createdAt: Date.now(),
  });
}
