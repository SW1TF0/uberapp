import React, { useState } from 'react';
import { View, Text, Switch, Pressable, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import database from '@react-native-firebase/database';
import { useNavigation } from '@react-navigation/native';
import { Bell, ChevronRight, Download, FileText, MapPin, ShieldCheck, Trash2 } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { useAuth } from '../../hooks/useAuth';
import { exportMyData } from '../../services/dataExport';
import { DeleteAccountModal } from '../../components/DeleteAccountModal';

export default function SettingsScreen() {
  const { profile, firebaseUser, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const notificationsEnabled = profile?.notificationsEnabled !== false;
  const [exporting, setExporting] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  async function toggleNotifications(value: boolean) {
    if (!firebaseUser) return;
    await database().ref(`/users/${firebaseUser.uid}/notificationsEnabled`).set(value);
  }

  async function handleExport() {
    if (!firebaseUser || !profile) return;
    setExporting(true);
    try {
      await exportMyData(firebaseUser.uid, profile);
    } catch (e) {
      Alert.alert('Грешка', e instanceof Error ? e.message : 'Неуспешно изтегляне на данните.');
    } finally {
      setExporting(false);
    }
  }

  async function handleAccountDeleted() {
    setDeleteModalVisible(false);
    await signOut().catch(() => undefined);
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Настройки</Text>

      <View style={styles.row}>
        <View style={styles.rowIcon}>
          <Bell size={18} color={colors.primary} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Известия</Text>
          <Text style={styles.rowHint}>Извести ме за промени в статуса на пътуването</Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={toggleNotifications}
          trackColor={{ true: colors.primary }}
          accessibilityLabel="Известия"
          accessibilityRole="switch"
        />
      </View>

      <Text style={styles.sectionHeading}>Поверителност</Text>

      <Pressable
        style={styles.linkRow}
        onPress={() => navigation.navigate('LegalDoc', { doc: 'privacy' })}
        accessibilityRole="button"
        accessibilityLabel="Отвори политиката за поверителност"
      >
        <View style={styles.rowIcon}>
          <ShieldCheck size={18} color={colors.primary} />
        </View>
        <Text style={styles.linkLabel}>Политика за поверителност</Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable
        style={styles.linkRow}
        onPress={() => navigation.navigate('LegalDoc', { doc: 'terms' })}
        accessibilityRole="button"
        accessibilityLabel="Отвори общите условия"
      >
        <View style={styles.rowIcon}>
          <FileText size={18} color={colors.primary} />
        </View>
        <Text style={styles.linkLabel}>Общи условия</Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable
        style={styles.linkRow}
        onPress={handleExport}
        disabled={exporting}
        accessibilityRole="button"
        accessibilityLabel="Изтегли моите данни"
      >
        <View style={styles.rowIcon}>
          <Download size={18} color={colors.primary} />
        </View>
        <Text style={styles.linkLabel}>Изтегли моите данни</Text>
        {exporting ? <ActivityIndicator size="small" color={colors.textMuted} /> : <ChevronRight size={18} color={colors.textMuted} />}
      </Pressable>

      <Pressable
        style={styles.linkRow}
        onPress={() => setDeleteModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Изтрий моя акаунт"
      >
        <View style={[styles.rowIcon, styles.dangerIcon]}>
          <Trash2 size={18} color={colors.danger} />
        </View>
        <Text style={[styles.linkLabel, styles.dangerLabel]}>Изтрий моя акаунт</Text>
        <ChevronRight size={18} color={colors.textMuted} />
      </Pressable>

      <View style={styles.infoBlock}>
        <View style={styles.infoBadge}>
          <MapPin size={22} color={colors.onPrimary} fill={colors.onPrimary} />
        </View>
        <Text style={styles.infoLine}>Kardzhali Ride</Text>
        <Text style={styles.infoLineMuted}>Версия 1.0.0</Text>
        <Text style={styles.infoLineMuted}>Валута: BGN (лв) · EUR (€)</Text>
      </View>

      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onDeleted={handleAccountDeleted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    ...shadows.card,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { color: colors.text, fontWeight: '600', fontSize: 15 },
  rowHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  sectionHeading: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 24, marginBottom: 10, letterSpacing: 0.5 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    ...shadows.card,
  },
  linkLabel: { color: colors.text, fontWeight: '600', fontSize: 14, flex: 1 },
  dangerIcon: { backgroundColor: 'rgba(220, 53, 69, 0.12)' },
  dangerLabel: { color: colors.danger },
  infoBlock: { marginTop: 40, alignItems: 'center' },
  infoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoLine: { color: colors.text, fontWeight: '600' },
  infoLineMuted: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
});
