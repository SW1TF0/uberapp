import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ShieldOff } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';

export default function BannedScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.flex}>
      <ShieldOff size={56} color={colors.danger} />
      <Text style={styles.title}>Профилът ти е спрян</Text>
      <Text style={styles.body}>
        Достъпът ти до Kardzhali Ride е спрян от администратор. Ако смяташ, че това е грешка, свържи се с
        поддръжката.
      </Text>
      <Pressable style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutLabel}>Изход</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 20, textAlign: 'center' },
  body: { color: colors.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  signOutButton: { backgroundColor: colors.danger, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40, marginTop: 32 },
  signOutLabel: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
});
