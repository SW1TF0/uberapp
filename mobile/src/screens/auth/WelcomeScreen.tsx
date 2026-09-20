import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MapPin, User, Car } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.flex}>
      <View style={styles.center}>
        <View style={styles.logoBadge}>
          <MapPin size={40} color={colors.onPrimary} fill={colors.onPrimary} />
        </View>
        <Text style={styles.title}>Kardzhali Ride</Text>
        <Text style={styles.subtitle}>Кърджали, посока накъде?</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('EmailAuth', { role: 'rider' })}
        >
          <User size={18} color={colors.onPrimary} />
          <Text style={styles.primaryLabel}>Продължи като пътник</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => navigation.navigate('EmailAuth', { role: 'driver' })}
        >
          <Car size={18} color={colors.text} />
          <Text style={styles.secondaryLabel}>Продължи като шофьор</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { color: colors.text, fontSize: 36, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 16, marginTop: 12 },
  actions: { padding: 24 },
  pressed: { opacity: 0.85 },
  primaryButton: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryLabel: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
