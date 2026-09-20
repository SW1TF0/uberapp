import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Car, LogOut, ShieldAlert, Users } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AdminStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';

type Props = NativeStackScreenProps<AdminStackParamList, 'AdminDashboard'>;

export default function AdminDashboardScreen({ navigation }: Props) {
  const { signOut } = useAuth();

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Администраторски панел</Text>
      <Text style={styles.subtitle}>Kardzhali Ride</Text>

      <Pressable style={styles.card} onPress={() => navigation.navigate('AdminDrivers')}>
        <View style={styles.iconBadge}>
          <Car size={22} color={colors.onPrimary} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Шофьори</Text>
          <Text style={styles.cardSubtitle}>Профили, такси към платформата, бан</Text>
        </View>
      </Pressable>

      <Pressable style={styles.card} onPress={() => navigation.navigate('AdminClients')}>
        <View style={styles.iconBadge}>
          <Users size={22} color={colors.onPrimary} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Клиенти</Text>
          <Text style={styles.cardSubtitle}>Списък с пътници, бан</Text>
        </View>
      </Pressable>

      <Pressable style={styles.card} onPress={() => navigation.navigate('AdminReports')}>
        <View style={styles.iconBadge}>
          <ShieldAlert size={22} color={colors.onPrimary} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>Жалби</Text>
          <Text style={styles.cardSubtitle}>Сигнали от шофьори и клиенти</Text>
        </View>
      </Pressable>

      <Pressable style={styles.signOutButton} onPress={signOut}>
        <LogOut size={18} color="#ffffff" />
        <Text style={styles.signOutLabel}>Изход</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 60 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  subtitle: { color: colors.textMuted, marginTop: 4, marginBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 'auto',
  },
  signOutLabel: { color: '#ffffff', fontWeight: '700' },
});
