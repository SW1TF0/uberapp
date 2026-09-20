import { create } from 'zustand';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { UserProfile } from '../types/models';

type AuthState = {
  firebaseUser: FirebaseAuthTypes.User | null;
  profile: UserProfile | null;
  loading: boolean;
  setFirebaseUser: (user: FirebaseAuthTypes.User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  profile: null,
  loading: true,
  setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
}));
