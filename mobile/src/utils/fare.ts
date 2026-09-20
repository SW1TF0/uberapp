import { GeoPoint, PricingRules, VehicleType } from '../types/models';

const AVERAGE_CITY_SPEED_KMH = 26;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Straight-line estimate used for the instant in-app fare quote. The
// destination picker and live trip screens show a real OSRM-routed
// polyline/ETA instead, and completeRide() in useRideDispatch.ts
// recomputes the authoritative final fare from the actual driven route
// (via OSRM) before logging it to ride history.
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isOutsideCityLimits(point: GeoPoint, pricing: PricingRules): boolean {
  const distanceFromCenter = haversineKm(point, pricing.cityGeofence.center);
  return distanceFromCenter > pricing.cityGeofence.radiusKm;
}

export type FareEstimate = {
  distanceKm: number;
  durationMin: number;
  isOuterZone: boolean;
  fareBGN: number;
};

export function estimateFare(
  pickup: GeoPoint,
  dropoff: GeoPoint,
  vehicleType: VehicleType,
  pricing: PricingRules
): FareEstimate {
  const distanceKm = haversineKm(pickup, dropoff);
  const durationMin = Math.max(3, Math.round((distanceKm / AVERAGE_CITY_SPEED_KMH) * 60));
  const isOuterZone = isOutsideCityLimits(pickup, pricing) || isOutsideCityLimits(dropoff, pricing);

  const multiplier = pricing.vehicleTypeMultipliers[vehicleType] ?? 1;
  let fareBGN =
    (pricing.baseFare + distanceKm * pricing.perKmRate + durationMin * pricing.perMinRate) *
    multiplier;
  if (isOuterZone) fareBGN *= pricing.outerSurchargeMultiplier;
  fareBGN = Math.max(pricing.minimumFare, Math.round(fareBGN * 100) / 100);

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    durationMin,
    isOuterZone,
    fareBGN,
  };
}

// Same pricing formula as estimateFare(), but for when distance/duration
// are already known (e.g. from an OSRM route) instead of being derived
// from pickup/dropoff via haversine.
export function fareFromDistance(
  distanceKm: number,
  durationMin: number,
  vehicleType: VehicleType,
  pricing: PricingRules,
  isOuterZone: boolean
): number {
  const multiplier = pricing.vehicleTypeMultipliers[vehicleType] ?? 1;
  let fareBGN =
    (pricing.baseFare + distanceKm * pricing.perKmRate + durationMin * pricing.perMinRate) *
    multiplier;
  if (isOuterZone) fareBGN *= pricing.outerSurchargeMultiplier;
  return Math.max(pricing.minimumFare, Math.round(fareBGN * 100) / 100);
}
