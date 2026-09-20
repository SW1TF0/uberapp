import { create } from 'zustand';
import { DriverRideOffer, Ride } from '../types/models';

type RideState = {
  activeRide: Ride | null;
  incomingOffer: DriverRideOffer | null;
  setActiveRide: (ride: Ride | null) => void;
  setIncomingOffer: (offer: DriverRideOffer | null) => void;
};

export const useRideStore = create<RideState>((set) => ({
  activeRide: null,
  incomingOffer: null,
  setActiveRide: (activeRide) => set({ activeRide }),
  setIncomingOffer: (incomingOffer) => set({ incomingOffer }),
}));
