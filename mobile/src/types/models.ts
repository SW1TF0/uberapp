export type Role = 'rider' | 'driver';
export type VehicleType = 'economy' | 'comfort' | 'xl';
export type PaymentMethod = 'cash' | 'card';
export type RideStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type DriverStatus = 'offline' | 'online' | 'busy';

export type UserProfile = {
  uid: string;
  role: Role;
  name: string;
  phone: string;
  email: string;
  createdAt: number;
};

export type DriverVehicle = {
  make: string;
  model: string;
  color: string;
  plate: string;
  type: VehicleType;
};

export type DriverLocation = {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updatedAt: number;
};

export type DriverRecord = {
  profile: {
    name: string;
    phone: string;
    rating: number;
    vehicle: DriverVehicle;
  };
  status: DriverStatus;
  location: DriverLocation | null;
};

export type GeoPoint = {
  lat: number;
  lng: number;
  address?: string;
};

export type Ride = {
  id: string;
  riderId: string;
  driverId: string | null;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  vehicleType: VehicleType;
  paymentMethod: PaymentMethod;
  status: RideStatus;
  distanceKm: number;
  durationMin: number;
  isOuterZone: boolean;
  fareEstimateBGN: number;
  finalFareBGN: number | null;
  requestedAt: number;
  acceptedAt: number | null;
  arrivedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  rating: number | null;
  matching?: RideMatchingState;
};

export type DriverRideOffer = {
  rideId: string;
  offeredAt: number;
  expiresAt: number;
  pickupDistanceKm: number;
  fareEstimateBGN: number;
};

// Client-side matching bookkeeping, written by the rider's own app (see
// useRideDispatch's attemptMatch) since there's no Cloud Function driving
// this in the free-tier setup. Lives at /rides/{rideId}/matching.
export type RideMatchingState = {
  offeredDriverId?: string;
  offeredAt?: number;
  expiresAt?: number;
  excludedDriverIds?: Record<string, boolean>;
};

export type PricingRules = {
  currency: 'BGN';
  baseFare: number;
  perKmRate: number;
  perMinRate: number;
  minimumFare: number;
  cancellationFee: number;
  cityGeofence: {
    center: { lat: number; lng: number };
    radiusKm: number;
  };
  outerSurchargeMultiplier: number;
  vehicleTypeMultipliers: Record<VehicleType, number>;
};
