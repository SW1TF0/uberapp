import * as ImagePicker from 'expo-image-picker';
import storage from '@react-native-firebase/storage';
import database from '@react-native-firebase/database';
import { Role } from '../types/models';

// Lets the signed-in user pick a photo from their library and uploads it
// to Firebase Storage (free on the Spark plan) at /avatars/{uid}, then
// writes the resulting download URL to /users/{uid}/avatarUrl — and, for
// drivers, to /drivers/{uid}/profile/avatarUrl too, since that's the
// separate record riders actually read while matched with them.
export async function pickAndUploadAvatar(uid: string, role: Role): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Нужен е достъп до снимките, за да смениш профилната снимка.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const uri = result.assets[0].uri;
  const reference = storage().ref(`/avatars/${uid}`);
  await reference.putFile(uri);
  const avatarUrl = await reference.getDownloadURL();

  const updates: Record<string, unknown> = { [`/users/${uid}/avatarUrl`]: avatarUrl };
  if (role === 'driver') {
    updates[`/drivers/${uid}/profile/avatarUrl`] = avatarUrl;
  }
  await database().ref().update(updates);

  return avatarUrl;
}
