import { GeoPoint } from './geo';

export type RouteResult = {
  distanceKm: number;
  durationMin: number;
};

// Server-side Directions lookup used to compute the AUTHORITATIVE final
// fare from the actual driven route, as opposed to the haversine estimate
// the client shows up front. Uses a separate, more-privileged API key than
// the client's EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (see GOOGLE_MAPS_SERVER_KEY
// secret, referenced from rideLifecycle.ts).
export async function fetchRouteDistance(
  origin: GeoPoint,
  destination: GeoPoint,
  apiKey: string
): Promise<RouteResult | null> {
  if (!apiKey) return null;

  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}` +
    `&destination=${destination.lat},${destination.lng}&key=${apiKey}`;

  const response = await fetch(url);
  const json = (await response.json()) as {
    status: string;
    routes?: Array<{ legs: Array<{ distance: { value: number }; duration: { value: number } }> }>;
  };

  if (json.status !== 'OK' || !json.routes?.length) return null;

  const leg = json.routes[0].legs[0];
  return {
    distanceKm: Math.round((leg.distance.value / 1000) * 10) / 10,
    durationMin: Math.round(leg.duration.value / 60),
  };
}
