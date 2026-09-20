import { GeoPoint, haversineKm } from './geo';

export type VehicleType = 'economy' | 'comfort' | 'xl';

// Mirrors mobile/src/types/models.ts#PricingRules and
// mobile/src/utils/fare.ts — kept as a separate copy here since the
// functions package deploys independently of the mobile app bundle.
export type PricingRules = {
  currency: 'BGN';
  baseFare: number;
  perKmRate: number;
  perMinRate: number;
  minimumFare: number;
  cancellationFee: number;
  cityGeofence: {
    center: GeoPoint;
    radiusKm: number;
  };
  outerSurchargeMultiplier: number;
  vehicleTypeMultipliers: Record<VehicleType, number>;
};

export function isOutsideCityLimits(point: GeoPoint, pricing: PricingRules): boolean {
  return haversineKm(point, pricing.cityGeofence.center) > pricing.cityGeofence.radiusKm;
}

export function computeFare(
  distanceKm: number,
  durationMin: number,
  vehicleType: VehicleType,
  pricing: PricingRules,
  isOuterZone: boolean
): number {
  const multiplier = pricing.vehicleTypeMultipliers[vehicleType] ?? 1;
  let fare =
    (pricing.baseFare + distanceKm * pricing.perKmRate + durationMin * pricing.perMinRate) *
    multiplier;
  if (isOuterZone) fare *= pricing.outerSurchargeMultiplier;
  return Math.max(pricing.minimumFare, Math.round(fare * 100) / 100);
}
