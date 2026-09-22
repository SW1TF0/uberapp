import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { AlertCircle, Car, CheckSquare, Phone, Shield, Square, User } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { shadows } from '../../theme/shadows';
import { useAuth } from '../../hooks/useAuth';
import { VehicleType } from '../../types/models';
import { LEGAL_DOCS_VERSION } from '../../content/legalContent';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSetup'>;

const VEHICLE_TYPES: { type: VehicleType; label: string }[] = [
  { type: 'economy', label: 'Икономична' },
  { type: 'comfort', label: 'Комфорт' },
  { type: 'xl', label: 'Голяма (XL)' },
];

// "ДД.ММ.ГГГГ" -> epoch ms, or null if the text doesn't parse to a real date.
function parseDDMMYYYY(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
    return null;
  }
  return date.getTime();
}

export default function ProfileSetupScreen({ route, navigation }: Props) {
  const { role } = route.params;
  const { completeRiderProfile, completeDriverProfile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('economy');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState('');
  const [insuranceExpiresText, setInsuranceExpiresText] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!name.trim() || !phone.trim()) {
      setError('Въведи име и телефон.');
      return;
    }
    if (role === 'driver' && (!make.trim() || !model.trim() || !color.trim() || !plate.trim())) {
      setError('Попълни всички данни за автомобила.');
      return;
    }
    let insuranceExpiresAt: number | null = null;
    if (role === 'driver') {
      if (!licenseNumber.trim() || !insurancePolicyNumber.trim() || !insuranceExpiresText.trim()) {
        setError('Попълни данните за съответствие (свидетелство и застраховка).');
        return;
      }
      insuranceExpiresAt = parseDDMMYYYY(insuranceExpiresText);
      if (!insuranceExpiresAt) {
        setError('Въведи валидна дата за застраховката във формат ДД.ММ.ГГГГ.');
        return;
      }
    }
    if (!acceptedTerms) {
      setError('Трябва да приемеш Общите условия и Политиката за поверителност.');
      return;
    }

    setLoading(true);
    try {
      const now = Date.now();
      const consent = { termsAcceptedAt: now, privacyAcceptedAt: now, version: LEGAL_DOCS_VERSION };
      if (role === 'driver') {
        await completeDriverProfile(
          name.trim(),
          phone.trim(),
          { make: make.trim(), model: model.trim(), color: color.trim(), plate: plate.trim(), type: vehicleType },
          consent,
          {
            licenseNumber: licenseNumber.trim(),
            insurancePolicyNumber: insurancePolicyNumber.trim(),
            insuranceExpiresAt: insuranceExpiresAt as number,
          }
        );
      } else {
        await completeRiderProfile(name.trim(), phone.trim(), consent);
      }
      // No manual navigation needed: RootNavigator swaps to the role stack
      // automatically once the /users/{uid} listener in useAuth picks up
      // the profile node this just created.
    } catch (e) {
      setError('Неуспешно записване на профила. Опитай пак.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{role === 'driver' ? 'Профил на шофьор' : 'Твоят профил'}</Text>

      <Text style={styles.label}>Име</Text>
      <View style={styles.inputRow}>
        <User size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholderTextColor={colors.textMuted}
          placeholder="Иван Иванов"
        />
      </View>

      <Text style={styles.label}>Телефон</Text>
      <View style={styles.inputRow}>
        <Phone size={18} color={colors.textMuted} />
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholderTextColor={colors.textMuted}
          placeholder="+359 88 123 4567"
        />
      </View>

      {role === 'driver' && (
        <View style={styles.vehicleCard}>
          <View style={styles.sectionTitleRow}>
            <Car size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Автомобил</Text>
          </View>
          <Text style={styles.label}>Марка</Text>
          <TextInput
            style={styles.plainInput}
            value={make}
            onChangeText={setMake}
            placeholderTextColor={colors.textMuted}
            placeholder="Toyota"
          />
          <Text style={styles.label}>Модел</Text>
          <TextInput
            style={styles.plainInput}
            value={model}
            onChangeText={setModel}
            placeholderTextColor={colors.textMuted}
            placeholder="Corolla"
          />
          <Text style={styles.label}>Цвят</Text>
          <TextInput
            style={styles.plainInput}
            value={color}
            onChangeText={setColor}
            placeholderTextColor={colors.textMuted}
            placeholder="Син"
          />
          <Text style={styles.label}>Регистрационен номер</Text>
          <TextInput
            style={styles.plainInput}
            value={plate}
            onChangeText={setPlate}
            placeholderTextColor={colors.textMuted}
            placeholder="K 1234 KH"
            autoCapitalize="characters"
          />

          <Text style={styles.label}>Клас автомобил</Text>
          <View style={styles.typeRow}>
            {VEHICLE_TYPES.map((v) => (
              <Pressable
                key={v.type}
                style={[styles.typeOption, vehicleType === v.type && styles.typeOptionSelected]}
                onPress={() => setVehicleType(v.type)}
              >
                <Text style={[styles.typeLabel, vehicleType === v.type && styles.typeLabelSelected]}>
                  {v.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {role === 'driver' && (
        <View style={styles.vehicleCard}>
          <View style={styles.sectionTitleRow}>
            <Shield size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>Съответствие</Text>
          </View>
          <Text style={styles.complianceHint}>
            Тези данни се преглеждат от администратора преди одобрение — виж Политиката за поверителност, §8.
          </Text>
          <Text style={styles.label}>Номер на свидетелство за управление</Text>
          <TextInput
            style={styles.plainInput}
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            placeholderTextColor={colors.textMuted}
            placeholder="123456789"
            autoCapitalize="characters"
          />
          <Text style={styles.label}>Номер на застрахователна полица</Text>
          <TextInput
            style={styles.plainInput}
            value={insurancePolicyNumber}
            onChangeText={setInsurancePolicyNumber}
            placeholderTextColor={colors.textMuted}
            placeholder="BG/12/123456789"
            autoCapitalize="characters"
          />
          <Text style={styles.label}>Полицата е валидна до</Text>
          <TextInput
            style={styles.plainInput}
            value={insuranceExpiresText}
            onChangeText={setInsuranceExpiresText}
            placeholderTextColor={colors.textMuted}
            placeholder="ДД.ММ.ГГГГ"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      )}

      <Pressable style={styles.consentRow} onPress={() => setAcceptedTerms((v) => !v)}>
        {acceptedTerms ? (
          <CheckSquare size={20} color={colors.primary} />
        ) : (
          <Square size={20} color={colors.textMuted} />
        )}
        <Text style={styles.consentText}>
          Приемам{' '}
          <Text style={styles.consentLink} onPress={() => navigation.navigate('LegalDoc', { doc: 'terms' })}>
            Общите условия
          </Text>{' '}
          и{' '}
          <Text style={styles.consentLink} onPress={() => navigation.navigate('LegalDoc', { doc: 'privacy' })}>
            Политиката за поверителност
          </Text>
        </Text>
      </Pressable>

      {!!error && (
        <View style={styles.errorRow}>
          <AlertCircle size={16} color={colors.danger} />
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      <Pressable style={styles.button} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonLabel}>Продължи</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 70, paddingBottom: 60 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 24 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  label: { color: colors.textMuted, marginTop: 14, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: 16 },
  vehicleCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    ...shadows.card,
  },
  complianceHint: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 24 },
  consentText: { color: colors.textMuted, fontSize: 13, flex: 1, lineHeight: 19 },
  consentLink: { color: colors.primary, fontWeight: '700' },
  plainInput: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeOption: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  typeOptionSelected: { backgroundColor: colors.primary },
  typeLabel: { color: colors.text, fontWeight: '600' },
  typeLabelSelected: { color: colors.onPrimary },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  error: { color: colors.danger, flexShrink: 1 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 30,
    ...shadows.card,
  },
  buttonLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
});
