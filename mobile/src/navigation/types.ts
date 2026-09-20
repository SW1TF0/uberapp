import { GeoPoint } from '../types/models';

export type AuthStackParamList = {
  Welcome: undefined;
  EmailAuth: { role: 'rider' | 'driver' };
  ProfileSetup: { role: 'rider' | 'driver' };
};

export type RiderStackParamList = {
  RiderMap: undefined;
  DestinationPicker: undefined;
  RideConfirm: { pickup: GeoPoint; dropoff: GeoPoint };
  LiveTrip: undefined;
  RideHistory: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type DriverStackParamList = {
  DriverDashboard: undefined;
  DriverTrip: undefined;
  DriverEarnings: undefined;
  Profile: undefined;
  Settings: undefined;
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminDrivers: undefined;
  AdminClients: undefined;
  AdminReports: undefined;
};
