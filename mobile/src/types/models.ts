export type Role = 'rider' | 'driver';
export type VehicleType = 'economy' | 'comfort' | 'xl';
export type PaymentMethod = 'cash' | 'card';
export type PaymentStatus = 'pending' | 'paid' | 'failed';
export type RideStatus =
  | 'requested'
  | 'accepted'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type DriverStatus = 'offline' | 'online' | 'busy';

// Recorded once at signup (GDPR/ЗЗЛД: proof of consent to the Terms and
// Privacy Policy in effect at that time). LEGAL_DOCS_VERSION in
// content/legalContent.ts is the version these timestamps refer to.
export type ConsentRecord = {
  termsAcceptedAt: number;
  privacyAcceptedAt: number;
  version: string;
};

export type UserProfile = {
  uid: string;
  role: Role;
  name: string;
  phone: string;
  email: string;
  createdAt: number;
  avatarUrl?: string;
  notificationsEnabled?: boolean;
  consent?: ConsentRecord;
  // Admin-only field (see database.rules.json) — a client can never set
  // this to true itself, and a banned rider/driver is blocked server-side
  // from creating rides, accepting rides, or going online.
  banned?: boolean;
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

// Plumbing for Bulgarian passenger-transport regulation (Auto Transport
// Act / Наредба № 34 for taxi & hired-car transport): the actual right to
// operate still requires the driver's own registration with the
// Executive Agency "Automobile Administration" and NRA — this only lets
// the driver submit the paperwork in-app for the admin to review before
// approving them, it does not itself make the platform compliant.
export type DriverCompliance = {
  licenseNumber: string;
  insurancePolicyNumber: string;
  insuranceExpiresAt: number;
  licenseDocUrl?: string;
  insuranceDocUrl?: string;
};

export type DriverRecord = {
  profile: {
    name: string;
    phone: string;
    rating: number;
    ratingCount: number;
    vehicle: DriverVehicle;
    avatarUrl?: string;
    carPhotoUrl?: string;
  };
  compliance?: DriverCompliance;
  status: DriverStatus;
  location: DriverLocation | null;
  // Admin bookkeeping: completed rides after this timestamp are what the
  // driver currently owes the platform in commission; set by the admin
  // panel's "mark as settled" action, which just bumps this to now.
  settledUpTo?: number;
  // Set to false by completeDriverProfile() at signup; only the admin can
  // flip it to true (database.rules.json). A driver can't set their own
  // status to 'online' — and so can never be matched — until this is true.
  approved: boolean;
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
  platformFeeBGN: number | null;
  driverEarningsBGN: number | null;
  requestedAt: number;
  acceptedAt: number | null;
  arrivedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  rating: number | null;
  reviewText: string | null;
  matching?: RideMatchingState;
  // Only meaningful when paymentMethod === 'card'. Set to 'pending' by
  // completeRide(), then flipped to 'paid'/'failed' server-side by the
  // stripeWebhook Cloud Function once Stripe confirms the charge — never
  // written directly by a client, so a rider can't just claim they paid.
  paymentStatus?: PaymentStatus | null;
  stripePaymentIntentId?: string | null;
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
  // Share of the fare the platform keeps; the rest (1 - rate) is the
  // driver's net earnings for that ride. 0.10 = 10%.
  platformCommissionRate: number;
};

export type Transaction = {
  rideId: string;
  riderId: string;
  driverId: string;
  vehicleType: VehicleType;
  paymentMethod: PaymentMethod;
  distanceKm: number;
  durationMin: number;
  fareBGN: number;
  platformFeeBGN: number;
  driverEarningsBGN: number;
  currency: 'BGN';
  completedAt: number;
};

export type Report = {
  id: string;
  reporterId: string;
  reporterRole: Role;
  reportedId: string;
  rideId: string | null;
  reason: string;
  createdAt: number;
};
