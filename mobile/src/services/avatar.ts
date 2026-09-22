import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import database from '@react-native-firebase/database';
import { Role } from '../types/models';

// Google requires the Blaze (paid) plan to create a Storage bucket on a
// new Firebase project at all, even though the free tier's own usage
// limits would cover an app this size — so there's no free managed file
// host to use here. Instead: shrink the photo down hard and store it as
// a base64 data URI directly on the already-free Realtime Database, which
// <Image source={{ uri }}> renders directly with no separate download step.
const MAX_DATA_URI_LENGTH = 150000; // matches database.rules.json's cap

async function pickAndEncode(
  size: { width: number; height: number },
  aspect: [number, number],
  errorLabel: string
): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Нужен е достъп до снимките, за да смениш снимката.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const manipulated = await ImageManipulator.manipulateAsync(
    result.assets[0].uri,
    [{ resize: size }],
    { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!manipulated.base64) {
    throw new Error('Неуспешна обработка на снимката.');
  }

  const dataUri = `data:image/jpeg;base64,${manipulated.base64}`;
  if (dataUri.length > MAX_DATA_URI_LENGTH) {
    throw new Error(`${errorLabel} е твърде голяма. Опитай с друга.`);
  }
  return dataUri;
}

export async function pickAndUploadAvatar(uid: string, role: Role): Promise<string | null> {
  const avatarUrl = await pickAndEncode({ width: 128, height: 128 }, [1, 1], 'Снимката');
  if (!avatarUrl) return null;

  const updates: Record<string, unknown> = { [`/users/${uid}/avatarUrl`]: avatarUrl };
  if (role === 'driver') {
    updates[`/drivers/${uid}/profile/avatarUrl`] = avatarUrl;
  }
  await database().ref().update(updates);

  return avatarUrl;
}

// Wider/shorter than the profile avatar since a car photo is naturally
// landscape; lives only under /drivers/{uid}/profile since it's a vehicle
// photo, not a personal one, so riders see it but it's not the person's
// own /users avatar.
export async function pickAndUploadCarPhoto(uid: string): Promise<string | null> {
  const carPhotoUrl = await pickAndEncode({ width: 200, height: 150 }, [4, 3], 'Снимката на автомобила');
  if (!carPhotoUrl) return null;

  await database().ref(`/drivers/${uid}/profile/carPhotoUrl`).set(carPhotoUrl);
  return carPhotoUrl;
}

// Optional photos of the driver's compliance documents (свидетелство за
// управление / застрахователна полица), reviewed by the admin before
// approval — see DriverCompliance in types/models.ts. Same free
// data-URI-on-RTDB storage as the avatar/car photo above.
export async function pickAndUploadLicenseDoc(uid: string): Promise<string | null> {
  const docUrl = await pickAndEncode({ width: 400, height: 260 }, [4, 3], 'Снимката на документа');
  if (!docUrl) return null;

  await database().ref(`/drivers/${uid}/compliance/licenseDocUrl`).set(docUrl);
  return docUrl;
}

export async function pickAndUploadInsuranceDoc(uid: string): Promise<string | null> {
  const docUrl = await pickAndEncode({ width: 400, height: 260 }, [4, 3], 'Снимката на документа');
  if (!docUrl) return null;

  await database().ref(`/drivers/${uid}/compliance/insuranceDocUrl`).set(docUrl);
  return docUrl;
}
