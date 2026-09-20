import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { useAuth } from '../../hooks/useAuth';
import { VehicleType } from '../../types/models';

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSetup'>;

const VEHICLE_TYPES: { type: VehicleType; label: string }[] = [
  { type: 'economy', label: 'Economy' },
  { type: 'comfort', label: 'Comfort' },
  { type: 'xl', label: 'XL' },
];

export default function ProfileSetupScreen({ route }: Props) {
  const { role } = route.params;
  const { completeRiderProfile, completeDriverProfile } = useAuth();
  const [name, setName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('economy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!name.trim()) {
      setError('Въведи име.');
      return;
    }
    if (role === 'driver' && (!make.trim() || !model.trim() || !color.trim() || !plate.trim())) {
      setError('Попълни всички данни за автомобила.');
      return;
    }

    setLoading(true);
    try {
      if (role === 'driver') {
        await completeDriverProfile(name.trim(), {
          make: make.trim(),
          model: model.trim(),
          color: color.trim(),
          plate: plate.trim(),
          type: vehicleType,
        });
      } else {
        await completeRiderProfile(name.trim());
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
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholderTextColor={colors.textMuted}
        placeholder="Иван Иванов"
      />

      {role === 'driver' && (
        <>
          <Text style={styles.sectionTitle}>Автомобил</Text>
          <Text style={styles.label}>Марка</Text>
          <TextInput
            style={styles.input}
            value={make}
            onChangeText={setMake}
            placeholderTextColor={colors.textMuted}
            placeholder="Toyota"
          />
          <Text style={styles.label}>Модел</Text>
          <TextInput
            style={styles.input}
            value={model}
            onChangeText={setModel}
            placeholderTextColor={colors.textMuted}
            placeholder="Corolla"
          />
          <Text style={styles.label}>Цвят</Text>
          <TextInput
            style={styles.input}
            value={color}
            onChangeText={setColor}
            placeholderTextColor={colors.textMuted}
            placeholder="Син"
          />
          <Text style={styles.label}>Регистрационен номер</Text>
          <TextInput
            style={styles.input}
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
        </>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonLabel}>Продължи</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { padding: 24, paddingTop: 70, paddingBottom: 60 },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 24 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 4 },
  label: { color: colors.textMuted, marginTop: 14, marginBottom: 8 },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeOption: { flex: 1, backgroundColor: colors.card, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  typeOptionSelected: { backgroundColor: colors.primary },
  typeLabel: { color: colors.text, fontWeight: '600' },
  typeLabelSelected: { color: colors.background },
  error: { color: colors.danger, marginTop: 16 },
  button: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 30 },
  buttonLabel: { color: colors.background, fontWeight: '700', fontSize: 16 },
});
