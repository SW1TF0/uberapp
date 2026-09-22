import { GeoPoint } from '../types/models';

export type AuthStackParamList = {
  Welcome: undefined;
  EmailAuth: { role: 'rider' | 'driver' };
  ProfileSetup: { role: 'rider' | 'driver' };
  LegalDoc: { doc: 'privacy' | 'terms' };
};

export type RiderStackParamList = {
  RiderMap: undefined;
  DestinationPicker: undefined;
  RideConfirm: { pickup: GeoPoint; dropoff: GeoPoint };
  LiveTrip: undefined;
  RideHistory: undefined;
  Profile: undefined;
  Settings: undefined;
  LegalDoc: { doc: 'privacy' | 'terms' };
};

export type DriverStackParamList = {
  DriverDashboard: undefined;
  DriverTrip: undefined;
  DriverEarnings: undefined;
  Profile: undefined;
  Settings: undefined;
  LegalDoc: { doc: 'privacy' | 'terms' };
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminDrivers: undefined;
  AdminClients: undefined;
  AdminReports: undefined;
};
