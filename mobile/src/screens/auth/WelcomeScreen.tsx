import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.flex}>
      <View style={styles.center}>
        <Text style={styles.title}>Kardzhali Ride</Text>
        <Text style={styles.subtitle}>Кърджали, посока накъде?</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('EmailAuth', { role: 'rider' })}
        >
          <Text style={styles.primaryLabel}>Продължи като пътник</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('EmailAuth', { role: 'driver' })}
        >
          <Text style={styles.secondaryLabel}>Продължи като шофьор</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 36, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 16, marginTop: 12 },
  actions: { padding: 24 },
  primaryButton: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryLabel: { color: colors.text, fontWeight: '700', fontSize: 16 },
});
