import { GeoPoint } from '../types/models';

// Client-restricted (HTTP referrer / package name) browser key — see
// README.md for the exact Google Cloud APIs this needs enabled
// (Places API, Directions API, Distance Matrix API).
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const KARDZHALI_CENTER: GeoPoint = { lat: 41.6367, lng: 25.3773 };
const AUTOCOMPLETE_RADIUS_M = 15000;

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

export type DirectionsResult = {
  polyline: GeoPoint[];
  distanceKm: number;
  durationMin: number;
};

export type DrivingEta = {
  distanceKm: number;
  durationMin: number;
};

// Decodes a Google-encoded polyline string into a list of lat/lng points.
function decodePolyline(encoded: string): GeoPoint[] {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const points: GeoPoint[] = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
  if (!query.trim() || !GOOGLE_MAPS_API_KEY) return [];

  const url =
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}` +
    `&location=${KARDZHALI_CENTER.lat},${KARDZHALI_CENTER.lng}&radius=${AUTOCOMPLETE_RADIUS_M}` +
    `&strictbounds=true&components=country:bg&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const json = await response.json();
  if (json.status !== 'OK') return [];

  return (json.predictions as Array<Record<string, any>>).map((p) => ({
    placeId: p.place_id,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? '',
  }));
}

export async function getPlaceCoordinates(placeId: string): Promise<GeoPoint> {
  if (!GOOGLE_MAPS_API_KEY) throw new Error('Google Maps API key is not configured.');

  const url =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}` +
    `&fields=geometry,formatted_address&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const json = await response.json();
  if (json.status !== 'OK') throw new Error('Could not load place details.');

  const location = json.result.geometry.location;
  return { lat: location.lat, lng: location.lng, address: json.result.formatted_address };
}

// Route shape + total distance/duration for drawing the live polyline.
// Returns null (rather than throwing) when no API key is configured, so
// callers can fall back to a straight dashed line between the two points.
export async function fetchDirections(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<DirectionsResult | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}` +
    `&destination=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const json = await response.json();
  if (json.status !== 'OK' || !json.routes?.length) return null;

  const route = json.routes[0];
  const leg = route.legs[0];
  return {
    polyline: decodePolyline(route.overview_polyline.points),
    distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
    durationMin: Math.round(leg.duration.value / 60),
  };
}

// Distance Matrix — used for the quick ETA badge (driver -> pickup/dropoff)
// on the driver's turn-by-turn screen, cheaper than a full Directions call
// when only the numbers (not the route shape) are needed.
export async function fetchDrivingEta(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<DrivingEta | null> {
  if (!GOOGLE_MAPS_API_KEY) return null;

  const url =
    `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}` +
    `&destinations=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}`;

  const response = await fetch(url);
  const json = await response.json();
  const element = json.rows?.[0]?.elements?.[0];
  if (json.status !== 'OK' || !element || element.status !== 'OK') return null;

  return {
    distanceKm: Math.round((element.distance.value / 1000) * 10) / 10,
    durationMin: Math.round(element.duration.value / 60),
  };
}
