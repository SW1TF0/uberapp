// @react-native-firebase initializes its native SDK automatically from the
// platform config files (google-services.json / GoogleService-Info.plist)
// declared in app.config.js — there is no JS-side apiKey object to fill in here,
// unlike the Firebase Web SDK. This module just exposes typed, ready-to-use
// instances so the rest of the app never imports the native packages directly.
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import database, { FirebaseDatabaseTypes } from '@react-native-firebase/database';

export type AuthUser = FirebaseAuthTypes.User;
export type DatabaseReference = FirebaseDatabaseTypes.Reference;
export type DataSnapshot = FirebaseDatabaseTypes.DataSnapshot;

export const firebaseAuth = auth();
export const firebaseDb = database();

export function dbRef(path: string): DatabaseReference {
  return firebaseDb.ref(path);
}

export function serverTimestamp(): object {
  return database.ServerValue.TIMESTAMP;
}
