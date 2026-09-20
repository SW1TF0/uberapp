import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { MapPin, Search } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RiderStackParamList } from '../../navigation/types';
import { colors } from '../../theme/colors';
import { CITY_CENTER, DEFAULT_REGION } from '../../data/kardzhaliRegion';
import { DirectionsResult, PlacePrediction, fetchDirections, searchPlaces } from '../../services/freeMaps';
import { LeafletMap } from '../../components/LeafletMap';
import { GeoPoint } from '../../types/models';

type Props = NativeStackScreenProps<RiderStackParamList, 'DestinationPicker'>;

export default function DestinationPickerScreen({ navigation }: Props) {
  const [pickup, setPickup] = useState<GeoPoint>({
    lat: CITY_CENTER.latitude,
    lng: CITY_CENTER.longitude,
    address: 'Текущо местоположение',
  });
  const [query, setQuery] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropoff, setDropoff] = useState<GeoPoint | null>(null);
  const [route, setRoute] = useState<DirectionsResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({});
      setPickup({ lat: loc.coords.latitude, lng: loc.coords.longitude, address: 'Текущо местоположение' });
    })();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setPredictions([]);
      return undefined;
    }
    setSearching(true);
    // Nominatim's usage policy asks for at most ~1 request/second; 600ms
    // keeps normal typing comfortably under that.
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(query);
      setPredictions(results);
      setSearching(false);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const selectPrediction = useCallback(
    async (prediction: PlacePrediction) => {
      // Nominatim's search results already include coordinates, so unlike
      // Google Places there's no separate "place details" round trip.
      const coords: GeoPoint = { lat: prediction.lat, lng: prediction.lng, address: prediction.mainText };
      setDropoff(coords);
      setPredictions([]);
      setQuery(prediction.mainText);
      setSearching(true);
      const directions = await fetchDirections(pickup, coords);
      setRoute(directions);
      setSearching(false);
    },
    [pickup]
  );

  function confirm() {
    if (!dropoff) return;
    navigation.navigate('RideConfirm', { pickup, dropoff });
  }

  return (
    <View style={styles.flex}>
      <View style={styles.searchPanel}>
        <View style={styles.inputRow}>
          <MapPin size={16} color={colors.primary} />
          <Text style={styles.pickupText} numberOfLines={1}>
            {pickup.address}
          </Text>
        </View>
        <View style={styles.inputRow}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Търси дестинация в Кърджали..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {searching && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}

        {predictions.length > 0 && (
          <FlatList
            data={predictions}
            keyExtractor={(p) => p.placeId}
            style={styles.predictionList}
            renderItem={({ item }) => (
              <Pressable style={styles.prediction} onPress={() => selectPrediction(item)}>
                <Text style={styles.predictionMain}>{item.mainText}</Text>
                <Text style={styles.predictionSecondary}>{item.secondaryText}</Text>
              </Pressable>
            )}
          />
        )}
      </View>

      {dropoff && (
        <>
          <LeafletMap
            style={styles.map}
            region={{
              latitude: (pickup.lat + dropoff.lat) / 2,
              longitude: (pickup.lng + dropoff.lng) / 2,
              latitudeDelta: DEFAULT_REGION.latitudeDelta,
              longitudeDelta: DEFAULT_REGION.longitudeDelta,
            }}
            markers={[
              { id: 'pickup', lat: pickup.lat, lng: pickup.lng, color: colors.primary },
              { id: 'dropoff', lat: dropoff.lat, lng: dropoff.lng, color: colors.danger },
            ]}
            polyline={route ? route.polyline : [pickup, dropoff]}
            polylineDashed={!route}
          />
          <View style={styles.confirmBar}>
            {route && (
              <Text style={styles.routeInfo}>
                {route.distanceKm} км · {route.durationMin} мин
              </Text>
            )}
            <Pressable style={styles.confirmButton} onPress={confirm}>
              <Text style={styles.confirmLabel}>Продължи</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  searchPanel: { padding: 20, paddingTop: 60, backgroundColor: colors.background },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 10,
  },
  pickupText: { color: colors.text, flex: 1 },
  input: { color: colors.text, flex: 1, fontSize: 16 },
  predictionList: { maxHeight: 220, backgroundColor: colors.card, borderRadius: 12 },
  prediction: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  predictionMain: { color: colors.text, fontSize: 15 },
  predictionSecondary: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  map: { flex: 1 },
  confirmBar: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  routeInfo: { color: colors.textMuted, textAlign: 'center', marginBottom: 10 },
  confirmButton: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  confirmLabel: { color: colors.background, fontWeight: '700', fontSize: 16 },
});
