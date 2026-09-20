import { GeoPoint } from '../types/models';

// Rough bounding box around Kardzhali used to bias/limit search results:
// left,top,right,bottom (lon,lat,lon,lat).
const VIEWBOX = '25.25,41.72,25.55,41.55';

export type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  lat: number;
  lng: number;
};

export type DirectionsResult = {
  polyline: GeoPoint[];
  distanceKm: number;
  durationMin: number;
};

// Nominatim (OpenStreetMap) search — free, no API key, no billing account.
// This hits the public demo endpoint, which asks for at most ~1
// request/second and a descriptive User-Agent identifying the app; both
// are honored below. For anything beyond personal/demo use, self-host
// Nominatim or switch to a paid provider — the public instance isn't
// meant for production traffic.
export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
  if (!query.trim()) return [];

  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=jsonv2&addressdetails=0&limit=6&viewbox=${VIEWBOX}&bounded=1`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'KardzhaliRide/1.0 (personal, non-commercial demo app)' },
    });
    if (!response.ok) return [];
    const results = (await response.json()) as Array<Record<string, any>>;

    return results.map((r) => {
      const displayName = r.display_name as string;
      const parts = displayName.split(',');
      return {
        placeId: String(r.place_id),
        mainText: parts[0]?.trim() ?? displayName,
        secondaryText: parts.slice(1, 3).join(',').trim(),
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
      };
    });
  } catch {
    return [];
  }
}

// OSRM's public demo router — free, no API key, driving profile. Not
// intended for production traffic (no uptime/rate-limit guarantee), but
// fine for a personal/demo app. Returns null on failure so callers can
// fall back to a straight dashed line between the two points.
export async function fetchDirections(
  origin: GeoPoint,
  destination: GeoPoint
): Promise<DirectionsResult | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    if (json.status && json.status !== 'Ok') return null;
    if (json.code !== 'Ok' || !json.routes?.length) return null;

    const route = json.routes[0];
    const polyline: GeoPoint[] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => ({ lat, lng })
    );

    return {
      polyline,
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      durationMin: Math.max(1, Math.round(route.duration / 60)),
    };
  } catch {
    return null;
  }
}
