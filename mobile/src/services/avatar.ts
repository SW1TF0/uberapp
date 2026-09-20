import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import database from '@react-native-firebase/database';
import { Role } from '../types/models';

// Google requires the Blaze (paid) plan to create a Storage bucket on a
// new Firebase project at all, even though the free tier's own usage
// limits would cover an app this size — so there's no free managed file
// host to use here. Instead: shrink the photo down hard (128x128, JPEG
// ~40% quality) and store it as a base64 data URI directly on the
// already-free Realtime Database. A compressed 128x128 avatar typically
// comes out under ~15KB, which <Image source={{ uri }}> renders directly
// with no separate download step needed.
const AVATAR_SIZE = 128;
const MAX_DATA_URI_LENGTH = 150000; // matches database.rules.json's cap

export async function pickAndUploadAvatar(uid: string, role: Role): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Нужен е достъп до снимките, за да смениш профилната снимка.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: { width: AVATAR_SIZE, height: AVATAR_SIZE } }],
    { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!manipulated.base64) {
    throw new Error('Неуспешна обработка на снимката.');
  }

  const avatarUrl = `data:image/jpeg;base64,${manipulated.base64}`;
  if (avatarUrl.length > MAX_DATA_URI_LENGTH) {
    throw new Error('Снимката е твърде голяма. Опитай с друга.');
  }

  const updates: Record<string, unknown> = { [`/users/${uid}/avatarUrl`]: avatarUrl };
  if (role === 'driver') {
    updates[`/drivers/${uid}/profile/avatarUrl`] = avatarUrl;
  }
  await database().ref().update(updates);

  return avatarUrl;
}
