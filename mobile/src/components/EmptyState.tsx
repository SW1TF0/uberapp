import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

// A plain callable type, not React.ComponentType — that also carries an
// optional static `propTypes` field whose type TS compares structurally
// against lucide's own (slightly different) prop typing, which fails for
// reasons unrelated to actual usage here.
type IconComponent = (props: { size?: number | string; color?: string }) => React.ReactNode;

type Props = {
  icon: IconComponent;
  text: string;
};

export function EmptyState({ icon: Icon, text }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconBadge}>
        <Icon size={26} color={colors.textMuted} />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 48, paddingHorizontal: 32 },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  text: { color: colors.textMuted, textAlign: 'center', fontSize: 14 },
});
