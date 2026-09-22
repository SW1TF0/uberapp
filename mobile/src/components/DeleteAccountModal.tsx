import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import auth from '@react-native-firebase/auth';
import { AlertTriangle } from 'lucide-react-native';
import { colors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';

type Props = {
  visible: boolean;
  onClose: () => void;
  onDeleted: () => void;
};

// GDPR Art. 17 self-service erasure. Firebase Auth refuses to delete an
// account whose sign-in is "stale" (auth/requires-recent-login), so this
// re-confirms the password first — that also doubles as a safety check
// against someone deleting the account from an unlocked, unattended phone.
export function DeleteAccountModal({ visible, onClose, onDeleted }: Props) {
  const { firebaseUser, deleteAccount } = useAuth();
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!firebaseUser?.email || !password) return;
    setSubmitting(true);
    setError('');
    try {
      const credential = auth.EmailAuthProvider.credential(firebaseUser.email, password);
      await firebaseUser.reauthenticateWithCredential(credential);
      await deleteAccount();
      setPassword('');
      onDeleted();
    } catch (e) {
      setError('Грешна парола или неуспешно изтриване. Опитай пак.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setPassword('');
    setError('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.wrap}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <AlertTriangle size={20} color={colors.danger} />
            <Text style={styles.title}>Изтриване на акаунта</Text>
          </View>
          <Text style={styles.hint}>
            Това ще изтрие профила ти и данните за вход завинаги. Потвърди с паролата си.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Парола"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={handleClose} disabled={submitting}>
              <Text style={styles.cancelLabel}>Отказ</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
              disabled={submitting || !password}
            >
              {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.confirmLabel}>Изтрий</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  card: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 10, lineHeight: 18 },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  button: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  cancelButton: { backgroundColor: colors.card },
  cancelLabel: { color: colors.text, fontWeight: '700' },
  confirmButton: { backgroundColor: colors.danger },
  confirmLabel: { color: '#ffffff', fontWeight: '700' },
});
