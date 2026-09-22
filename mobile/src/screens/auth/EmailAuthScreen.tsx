import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { AlertCircle, Lock, Mail } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { useAuth } from '../../hooks/useAuth';

type Props = NativeStackScreenProps<AuthStackParamList, 'EmailAuth'>;
type Mode = 'signup' | 'signin';

export default function EmailAuthScreen({ route, navigation }: Props) {
  const { role } = route.params;
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!email.trim() || password.length < 6) {
      setError('Въведи имейл и парола (мин. 6 символа).');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        navigation.replace('ProfileSetup', { role });
      } else {
        await signIn(email, password);
        // No manual navigation here: RootNavigator swaps to the role stack
        // automatically once the /users/{uid} profile listener resolves.
      }
    } catch (e) {
      setError(
        mode === 'signup'
          ? 'Неуспешна регистрация. Имейлът може вече да е зает, или паролата е твърде слаба.'
          : 'Грешен имейл или парола.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>{role === 'driver' ? 'Профил на шофьор' : 'Профил на пътник'}</Text>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, mode === 'signup' && styles.tabActive]} onPress={() => setMode('signup')}>
          <Text style={[styles.tabLabel, mode === 'signup' && styles.tabLabelActive]}>Нов профил</Text>
        </Pressable>
        <Pressable style={[styles.tab, mode === 'signin' && styles.tabActive]} onPress={() => setMode('signin')}>
          <Text style={[styles.tabLabel, mode === 'signin' && styles.tabLabelActive]}>Вход</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Имейл</Text>
      <View style={styles.inputRow}>
        <Mail size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholderTextColor={colors.textMuted}
          placeholder="ivan@example.com"
        />
      </View>

      <Text style={styles.label}>Парола</Text>
      <View style={styles.inputRow}>
        <Lock size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholderTextColor={colors.textMuted}
          placeholder="Минимум 6 символа"
        />
      </View>

      {!!error && (
        <View style={styles.errorRow}>
          <AlertCircle size={16} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      <Pressable style={styles.button} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonLabel}>{mode === 'signup' ? 'Създай профил' : 'Влез'}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: 80 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 20 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    ...shadows.card,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabLabel: { color: colors.textMuted, fontWeight: '600' },
  tabLabelActive: { color: colors.onPrimary },
  label: { color: colors.textMuted, marginBottom: 8, marginTop: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: 14,
    fontSize: 16,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  error: { color: colors.danger, flexShrink: 1 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    ...shadows.card,
  },
  buttonLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
});
