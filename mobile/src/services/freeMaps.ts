import { GeoPoint } from '../types/models';

// Rough bounding box around Kardzhali used to bias/limit search results:
// left,top,right,bottom (lon,lat,lon,lat).
const VIEWBOX = '25.25,41.72,25.55,41.55';
const USER_AGENT = 'KardzhaliRide/1.0 (personal, non-commercial demo app)';

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

function toPredictions(results: Array<Record<string, any>>): PlacePrediction[] {
  return results.map((r) => {
    const displayName = r.display_name as string;
    const parts = displayName.split(',');
    // A tagged POI's own name (school, hospital, ...) is often already
    // parts[0]; for a bare address hit that's just a house number, so fall
    // back to the 'name' field Nominatim returns for named places.
    const mainText = (r.name as string) || parts[0]?.trim() || displayName;
    return {
      placeId: String(r.place_id),
      mainText,
      secondaryText: parts.slice(mainText === parts[0]?.trim() ? 1 : 0, 3).join(',').trim(),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    };
  });
}

async function nominatimSearch(query: string, bounded: boolean, limit: number): Promise<Array<Record<string, any>>> {
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
    `&format=jsonv2&addressdetails=0&namedetails=1&accept-language=bg` +
    `&limit=${limit}&viewbox=${VIEWBOX}&bounded=${bounded ? 1 : 0}`;

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) return [];
  return (await response.json()) as Array<Record<string, any>>;
}

// Nominatim (OpenStreetMap) search — free, no API key, no billing account.
// This hits the public demo endpoint, which asks for at most ~1
// request/second and a descriptive User-Agent identifying the app; both
// are honored below. For anything beyond personal/demo use, self-host
// Nominatim or switch to a paid provider — the public instance isn't
// meant for production traffic.
export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  try {
    // Strictly bounded to Kardzhali first — best relevance for the common
    // case (a street, shop, or school actually in town).
    let results = await nominatimSearch(trimmed, true, 8);
    // A short/partial name (e.g. "Училище Пайси" for a school whose full
    // tagged name is longer) can fall just outside strict bounding or miss
    // the stricter match Nominatim needs — retry once, unbounded but still
    // viewbox-prioritized, so a real match elsewhere isn't just dropped.
    if (results.length === 0) {
      results = await nominatimSearch(trimmed, false, 8);
    }
    return toPredictions(results);
  } catch {
    return [];
  }
}

export type RecommendedPlace = PlacePrediction & { kind: string };

// Query terms, not hardcoded coordinates — every recommended place is
// fetched live from Nominatim so its position is always real OSM data,
// never a guessed lat/lng. Cached in-memory per app session since these
// don't change and Nominatim's usage policy asks for restraint.
const RECOMMENDED_QUERIES: { query: string; kind: string }[] = [
  { query: 'Община Кърджали', kind: 'landmark' },
  { query: 'Автогара Кърджали', kind: 'bus' },
  { query: 'МБАЛ Кърджали', kind: 'hospital' },
  { query: 'Мол Кърджали', kind: 'shop' },
  { query: 'Централен площад, Кърджали', kind: 'landmark' },
  { query: 'Язовир Кърджали', kind: 'landmark' },
];

let recommendedCache: RecommendedPlace[] | null = null;
let recommendedPromise: Promise<RecommendedPlace[]> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchRecommendedPlaces(): Promise<RecommendedPlace[]> {
  if (recommendedCache) return recommendedCache;
  if (recommendedPromise) return recommendedPromise;

  recommendedPromise = (async () => {
    const places: RecommendedPlace[] = [];
    for (const { query, kind } of RECOMMENDED_QUERIES) {
      try {
        const results = await nominatimSearch(query, true, 1);
        const [prediction] = toPredictions(results);
        if (prediction) places.push({ ...prediction, mainText: query.split(',')[0], kind });
      } catch {
        // Skip a landmark that fails to resolve rather than failing the
        // whole list.
      }
      // Nominatim's public instance asks for at most ~1 request/second.
      await sleep(1100);
    }
    recommendedCache = places;
    return places;
  })();

  return recommendedPromise;
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
