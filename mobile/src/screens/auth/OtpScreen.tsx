import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';

type Props = NativeStackScreenProps<AuthStackParamList, 'Otp'>;

export default function OtpScreen({ route, navigation }: Props) {
  const { role, phone } = route.params;
  const { confirmOtp } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await confirmOtp(code.trim());
      // If this is a returning user, useAuth's /users/{uid} listener will
      // resolve their existing profile shortly and RootNavigator swaps
      // straight to their role stack, unmounting this navigator before
      // ProfileSetup is ever seen. For a new user, profile stays null and
      // this is where they land.
      navigation.replace('ProfileSetup', { role });
    } catch (e) {
      setError('Грешен код. Опитай пак.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>Въведи кода</Text>
      <Text style={styles.subtitle}>Изпратихме код на {phone}</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        placeholderTextColor={colors.textMuted}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonLabel}>Потвърди</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 80 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: colors.textMuted, marginTop: 8, marginBottom: 24 },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  error: { color: colors.danger, marginTop: 12 },
  button: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  buttonLabel: { color: colors.background, fontWeight: '700', fontSize: 16 },
});
