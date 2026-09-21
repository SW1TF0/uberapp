import { useCallback, useEffect } from 'react';
import auth from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import { useAuthStore } from '../store/authStore';
import { DriverVehicle, UserProfile } from '../types/models';

// Wraps @react-native-firebase email/password auth + the /users profile
// node. Email/password is unambiguously free on Firebase's Spark plan (no
// SMS costs, no billing account needed at all), unlike phone OTP — that's
// why this app uses it instead. Still needs the native SDK though, so this
// app must run through a custom dev client (EAS Build / `expo prebuild`),
// not Expo Go.
export function useAuth() {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);

  // `loading` only tracks whether we've heard from Firebase Auth at least
  // once (the initial app-boot check for a cached session). It must NOT be
  // re-triggered on every later sign-in, or RootNavigator's top-level
  // loading/AuthStack switch would unmount the auth navigator mid-flow.
  // Which stack to show afterwards is driven entirely by `profile` being
  // null or not.
  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged((user) => {
      setFirebaseUser(user);
      if (!user) setProfile(null);
      setLoading(false);
    });
    return unsubscribeAuth;
  }, [setFirebaseUser, setProfile, setLoading]);

  useEffect(() => {
    if (!firebaseUser) return undefined;
    const profileRef = database().ref(`/users/${firebaseUser.uid}`);
    const onValueChange = profileRef.on('value', (snapshot) => {
      setProfile(snapshot.exists() ? (snapshot.val() as UserProfile) : null);
    });
    return () => profileRef.off('value', onValueChange);
  }, [firebaseUser, setProfile]);

  const signUp = useCallback(async (email: string, password: string): Promise<void> => {
    await auth().createUserWithEmailAndPassword(email.trim(), password);
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    await auth().signInWithEmailAndPassword(email.trim(), password);
  }, []);

  const completeRiderProfile = useCallback(async (name: string, phone: string): Promise<void> => {
    const user = auth().currentUser;
    if (!user) throw new Error('Не си влязъл в профила си.');

    const newProfile: UserProfile = {
      uid: user.uid,
      role: 'rider',
      name,
      phone,
      email: user.email ?? '',
      createdAt: Date.now(),
    };
    await database().ref(`/users/${user.uid}`).set(newProfile);
  }, []);

  const completeDriverProfile = useCallback(
    async (name: string, phone: string, vehicle: DriverVehicle): Promise<void> => {
      const user = auth().currentUser;
      if (!user) throw new Error('Не си влязъл в профила си.');

      const newProfile: UserProfile = {
        uid: user.uid,
        role: 'driver',
        name,
        phone,
        email: user.email ?? '',
        createdAt: Date.now(),
      };

      const updates: Record<string, unknown> = {
        [`/users/${user.uid}`]: newProfile,
        [`/drivers/${user.uid}/profile`]: {
          name,
          phone,
          rating: 5,
          vehicle,
        },
        [`/drivers/${user.uid}/status`]: 'offline',
        // New drivers can't go online until an admin approves them (see
        // "Admin panel" in README.md and database.rules.json's approved
        // field) — this is the only value a driver is allowed to
        // self-write there; only the admin account can flip it to true.
        [`/drivers/${user.uid}/approved`]: false,
      };
      await database().ref().update(updates);
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    const user = auth().currentUser;
    if (user) {
      await database()
        .ref(`/drivers/${user.uid}/status`)
        .set('offline')
        .catch(() => undefined);
    }
    await auth().signOut();
  }, []);

  return {
    firebaseUser,
    profile,
    loading,
    signUp,
    signIn,
    completeRiderProfile,
    completeDriverProfile,
    signOut,
  };
}
