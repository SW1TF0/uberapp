import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();

  return (
    <View style={styles.flex}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{profile?.name?.[0] ?? '?'}</Text>
      </View>
      <Text style={styles.name}>{profile?.name}</Text>
      <Text style={styles.phone}>{profile?.phone}</Text>
      <Pressable style={styles.signOutButton} onPress={signOut}>
        <LogOut size={18} color="#ffffff" />
        <Text style={styles.signOutLabel}>Изход</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, alignItems: 'center', paddingTop: 100 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 32, fontWeight: '700' },
  name: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 16 },
  phone: { color: colors.textMuted, marginTop: 4 },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 30,
    marginTop: 40,
  },
  signOutLabel: { color: '#ffffff', fontWeight: '700' },
});
