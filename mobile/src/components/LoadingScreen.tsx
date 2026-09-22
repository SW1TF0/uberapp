import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors } from '../theme/colors';

type Props = {
  label?: string;
};

export function LoadingScreen({ label }: Props) {
  return (
    <View style={styles.flex}>
      <View style={styles.logoBadge}>
        <MapPin size={28} color={colors.onPrimary} fill={colors.onPrimary} />
      </View>
      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
      {!!label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  spinner: { marginTop: 4 },
  label: { color: colors.textMuted, marginTop: 14, fontSize: 13 },
});
