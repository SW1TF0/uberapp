import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import database from '@react-native-firebase/database';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';

export default function SettingsScreen() {
  const { profile, firebaseUser } = useAuth();
  const notificationsEnabled = profile?.notificationsEnabled !== false;

  async function toggleNotifications(value: boolean) {
    if (!firebaseUser) return;
    await database().ref(`/users/${firebaseUser.uid}/notificationsEnabled`).set(value);
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Настройки</Text>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Известия</Text>
          <Text style={styles.rowHint}>Извести ме за промени в статуса на пътуването</Text>
        </View>
        <Switch value={notificationsEnabled} onValueChange={toggleNotifications} trackColor={{ true: colors.primary }} />
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.infoLine}>Kardzhali Ride</Text>
        <Text style={styles.infoLineMuted}>Версия 1.0.0</Text>
        <Text style={styles.infoLineMuted}>Валута: BGN (лв) · EUR (€)</Text>
      </View>
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
  },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { color: colors.text, fontWeight: '600', fontSize: 15 },
  rowHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  infoBlock: { marginTop: 30, alignItems: 'center' },
  infoLine: { color: colors.text, fontWeight: '600' },
  infoLineMuted: { color: colors.textMuted, marginTop: 4, fontSize: 12 },
});
