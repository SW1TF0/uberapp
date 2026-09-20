import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';

type Props = NativeStackScreenProps<AuthStackParamList, 'PhoneLogin'>;

export default function PhoneLoginScreen({ route, navigation }: Props) {
  const { role } = route.params;
  const { sendOtp } = useAuth();
  const [phone, setPhone] = useState('+359');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setLoading(true);
    try {
      await sendOtp(phone.trim());
      navigation.navigate('Otp', { role, phone: phone.trim() });
    } catch (e) {
      setError('Неуспешно изпращане на код. Провери номера и опитай пак.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>{role === 'driver' ? 'Вход за шофьори' : 'Вход за пътници'}</Text>
      <Text style={styles.label}>Телефонен номер</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholderTextColor={colors.textMuted}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonLabel}>Изпрати код</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 80 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 24 },
  label: { color: colors.textMuted, marginBottom: 8 },
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
