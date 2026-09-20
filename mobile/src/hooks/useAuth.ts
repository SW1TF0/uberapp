import { useCallback, useEffect, useRef } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import { useAuthStore } from '../store/authStore';
import { DriverVehicle, UserProfile } from '../types/models';

// Wraps @react-native-firebase phone-number auth + the /users profile node.
// Note: phone auth requires the native Firebase SDK, so this app must run
// through a custom dev client (EAS Build / `expo prebuild`), not Expo Go.
export function useAuth() {
  const firebaseUser = useAuthStore((s) => s.firebaseUser);
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);
  const setFirebaseUser = useAuthStore((s) => s.setFirebaseUser);
  const setProfile = useAuthStore((s) => s.setProfile);
  const setLoading = useAuthStore((s) => s.setLoading);

  const confirmationRef = useRef<FirebaseAuthTypes.ConfirmationResult | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged((user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribeAuth;
  }, [setFirebaseUser, setProfile, setLoading]);

  useEffect(() => {
    if (!firebaseUser) return undefined;
    setLoading(true);
    const profileRef = database().ref(`/users/${firebaseUser.uid}`);
    const onValueChange = profileRef.on('value', (snapshot) => {
      setProfile(snapshot.exists() ? (snapshot.val() as UserProfile) : null);
      setLoading(false);
    });
    return () => profileRef.off('value', onValueChange);
  }, [firebaseUser, setProfile, setLoading]);

  const sendOtp = useCallback(async (phoneNumber: string): Promise<void> => {
    const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
    confirmationRef.current = confirmation;
  }, []);

  const confirmOtp = useCallback(async (code: string): Promise<FirebaseAuthTypes.User | null> => {
    if (!confirmationRef.current) {
      throw new Error('Заяви код за потвърждение първо.');
    }
    const credential = await confirmationRef.current.confirm(code);
    confirmationRef.current = null;
    return credential?.user ?? null;
  }, []);

  const completeRiderProfile = useCallback(async (name: string): Promise<void> => {
    const user = auth().currentUser;
    if (!user) throw new Error('Не си влязъл в профила си.');

    const newProfile: UserProfile = {
      uid: user.uid,
      role: 'rider',
      name,
      phone: user.phoneNumber ?? '',
      createdAt: Date.now(),
    };
    await database().ref(`/users/${user.uid}`).set(newProfile);
  }, []);

  const completeDriverProfile = useCallback(
    async (name: string, vehicle: DriverVehicle): Promise<void> => {
      const user = auth().currentUser;
      if (!user) throw new Error('Не си влязъл в профила си.');

      const newProfile: UserProfile = {
        uid: user.uid,
        role: 'driver',
        name,
        phone: user.phoneNumber ?? '',
        createdAt: Date.now(),
      };

      const updates: Record<string, unknown> = {
        [`/users/${user.uid}`]: newProfile,
        [`/drivers/${user.uid}/profile`]: {
          name,
          phone: user.phoneNumber ?? '',
          rating: 5,
          vehicle,
        },
        [`/drivers/${user.uid}/status`]: 'offline',
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
    sendOtp,
    confirmOtp,
    completeRiderProfile,
    completeDriverProfile,
    signOut,
  };
}
