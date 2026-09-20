import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { AnimatedRegion, MarkerAnimated } from 'react-native-maps';
import { Car } from 'lucide-react-native';
import { colors } from '../theme/colors';

type Props = {
  lat: number;
  lng: number;
  rotation?: number;
  color?: string;
};

// Smoothly tweens a driver's marker between successive location updates
// instead of snapping, using react-native-maps' AnimatedRegion as the
// marker coordinate.
export function AnimatedDriverMarker({ lat, lng, rotation = 0, color = colors.primary }: Props) {
  const coordinate = useRef(
    new AnimatedRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  useEffect(() => {
    coordinate
      .timing({
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration: 1000,
        useNativeDriver: false,
      } as never)
      .start();
  }, [lat, lng, coordinate]);

  return (
    <MarkerAnimated coordinate={coordinate as never} anchor={{ x: 0.5, y: 0.5 }} flat>
      <View style={[styles.pin, { backgroundColor: color, transform: [{ rotate: `${rotation}deg` }] }]}>
        <Car size={16} color={colors.background} />
      </View>
    </MarkerAnimated>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
