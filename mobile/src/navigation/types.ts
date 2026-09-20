import { GeoPoint } from '../types/models';

export type AuthStackParamList = {
  Welcome: undefined;
  PhoneLogin: { role: 'rider' | 'driver' };
  Otp: { role: 'rider' | 'driver'; phone: string };
  ProfileSetup: { role: 'rider' | 'driver' };
};

export type RiderStackParamList = {
  RiderMap: undefined;
  DestinationPicker: undefined;
  RideConfirm: { pickup: GeoPoint; dropoff: GeoPoint };
  LiveTrip: undefined;
  Profile: undefined;
};

export type DriverStackParamList = {
  DriverDashboard: undefined;
  DriverTrip: undefined;
  Profile: undefined;
};
