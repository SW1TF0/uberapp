import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import database from '@react-native-firebase/database';
import { LogOut, Camera, Car, FileCheck, Settings as SettingsIcon, Shield } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';
import {
  pickAndUploadAvatar,
  pickAndUploadCarPhoto,
  pickAndUploadInsuranceDoc,
  pickAndUploadLicenseDoc,
} from '../../services/avatar';
import { DriverCompliance } from '../../types/models';

export default function ProfileScreen() {
  const { profile, firebaseUser, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [uploading, setUploading] = useState(false);
  const [uploadingCar, setUploadingCar] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);
  const [uploadingInsurance, setUploadingInsurance] = useState(false);
  const [carPhotoUrl, setCarPhotoUrl] = useState<string | null>(null);
  const [compliance, setCompliance] = useState<DriverCompliance | null>(null);

  useEffect(() => {
    if (!firebaseUser || profile?.role !== 'driver') return undefined;
    const ref = database().ref(`/drivers/${firebaseUser.uid}/profile/carPhotoUrl`);
    const listener = ref.on('value', (snap) => setCarPhotoUrl(snap.val() as string | null));
    return () => ref.off('value', listener);
  }, [firebaseUser, profile?.role]);

  useEffect(() => {
    if (!firebaseUser || profile?.role !== 'driver') return undefined;
    const ref = database().ref(`/drivers/${firebaseUser.uid}/compliance`);
    const listener = ref.on('value', (snap) => setCompliance(snap.val() as DriverCompliance | null));
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

  async function uploadLicenseDoc() {
    if (!firebaseUser) return;
    setUploadingLicense(true);
    try {
      await pickAndUploadLicenseDoc(firebaseUser.uid);
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно качване на документа.');
    } finally {
      setUploadingLicense(false);
    }
  }

  async function uploadInsuranceDoc() {
    if (!firebaseUser) return;
    setUploadingInsurance(true);
    try {
      await pickAndUploadInsuranceDoc(firebaseUser.uid);
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно качване на документа.');
    } finally {
      setUploadingInsurance(false);
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

      {profile?.role === 'driver' && (
        <View style={styles.complianceSection}>
          <View style={styles.complianceHeaderRow}>
            <Shield size={16} color={colors.primary} />
            <Text style={styles.complianceHeader}>Документи за съответствие</Text>
          </View>
          <Pressable style={styles.docRow} onPress={uploadLicenseDoc} disabled={uploadingLicense}>
            <FileCheck size={16} color={compliance?.licenseDocUrl ? colors.primary : colors.textMuted} />
            <Text style={styles.docLabel}>
              {compliance?.licenseDocUrl ? 'Свидетелство за управление · качено' : 'Качи свидетелство за управление'}
            </Text>
            {uploadingLicense && <ActivityIndicator size="small" color={colors.textMuted} />}
          </Pressable>
          <Pressable style={styles.docRow} onPress={uploadInsuranceDoc} disabled={uploadingInsurance}>
            <FileCheck size={16} color={compliance?.insuranceDocUrl ? colors.primary : colors.textMuted} />
            <Text style={styles.docLabel}>
              {compliance?.insuranceDocUrl ? 'Застрахователна полица · качена' : 'Качи застрахователна полица'}
            </Text>
            {uploadingInsurance && <ActivityIndicator size="small" color={colors.textMuted} />}
          </Pressable>
        </View>
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
  complianceSection: { width: '100%', paddingHorizontal: 24, marginTop: 28 },
  complianceHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  complianceHeader: { color: colors.text, fontWeight: '700', fontSize: 13 },
  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  docLabel: { color: colors.text, fontSize: 12, flex: 1 },
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
