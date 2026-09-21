import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import database from '@react-native-firebase/database';
import { LogOut, Camera, Car, Settings as SettingsIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';
import { pickAndUploadAvatar, pickAndUploadCarPhoto } from '../../services/avatar';

export default function ProfileScreen() {
  const { profile, firebaseUser, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [uploading, setUploading] = useState(false);
  const [uploadingCar, setUploadingCar] = useState(false);
  const [carPhotoUrl, setCarPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser || profile?.role !== 'driver') return undefined;
    const ref = database().ref(`/drivers/${firebaseUser.uid}/profile/carPhotoUrl`);
    const listener = ref.on('value', (snap) => setCarPhotoUrl(snap.val() as string | null));
    return () => ref.off('value', listener);
  }, [firebaseUser, profile?.role]);

  async function changeAvatar() {
    if (!firebaseUser || !profile) return;
    setUploading(true);
    try {
      await pickAndUploadAvatar(firebaseUser.uid, profile.role);
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно качване на снимката.');
    } finally {
      setUploading(false);
    }
  }

  async function changeCarPhoto() {
    if (!firebaseUser) return;
    setUploadingCar(true);
    try {
      await pickAndUploadCarPhoto(firebaseUser.uid);
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно качване на снимката.');
    } finally {
      setUploadingCar(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Pressable style={styles.avatarWrap} onPress={changeAvatar} disabled={uploading}>
        {profile?.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{profile?.name?.[0] ?? '?'}</Text>
          </View>
        )}
        <View style={styles.cameraBadge}>
          {uploading ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Camera size={14} color={colors.onPrimary} />}
        </View>
      </Pressable>

      <Text style={styles.name}>{profile?.name}</Text>
      <Text style={styles.phone}>{profile?.phone}</Text>
      <Text style={styles.email}>{profile?.email}</Text>

      {profile?.role === 'driver' && (
        <Pressable style={styles.carPhotoWrap} onPress={changeCarPhoto} disabled={uploadingCar}>
          {carPhotoUrl ? (
            <Image source={{ uri: carPhotoUrl }} style={styles.carPhoto} />
          ) : (
            <View style={styles.carPhotoPlaceholder}>
              <Car size={22} color={colors.textMuted} />
              <Text style={styles.carPhotoPlaceholderText}>Добави снимка на автомобила</Text>
            </View>
          )}
          <View style={styles.carCameraBadge}>
            {uploadingCar ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Camera size={14} color={colors.onPrimary} />
            )}
          </View>
        </Pressable>
      )}

      <Pressable style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
        <SettingsIcon size={18} color={colors.text} />
        <Text style={styles.settingsLabel}>Настройки</Text>
      </Pressable>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <LogOut size={18} color="#ffffff" />
        <Text style={styles.signOutLabel}>Изход</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, alignItems: 'center', paddingTop: 100 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { color: colors.text, fontSize: 32, fontWeight: '700' },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  name: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 16 },
  phone: { color: colors.textMuted, marginTop: 4 },
  email: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  carPhotoWrap: { position: 'relative', marginTop: 24, width: 220 },
  carPhoto: { width: 220, height: 140, borderRadius: 16 },
  carPhotoPlaceholder: {
    width: 220,
    height: 140,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  carPhotoPlaceholderText: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  carCameraBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 30,
    marginTop: 32,
  },
  settingsLabel: { color: colors.text, fontWeight: '600' },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 30,
    marginTop: 16,
  },
  signOutLabel: { color: '#ffffff', fontWeight: '700' },
});
