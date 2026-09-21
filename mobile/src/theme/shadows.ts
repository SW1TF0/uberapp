import { Platform } from 'react-native';

// A couple of elevation presets for floating cards/sheets over the map —
// RN's shadow* props only render on iOS, so every preset also sets
// Android's elevation to the closest equivalent.
export const shadows = {
  card: Platform.select({
    ios: { shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 4 },
    default: {},
  }),
  sheet: Platform.select({
    ios: { shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: -4 } },
    android: { elevation: 12 },
    default: {},
  }),
};
