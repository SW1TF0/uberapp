import React from 'react';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { StripeProvider } from '@stripe/stripe-react-native';
import RootNavigator from './src/navigation/RootNavigator';

const stripePublishableKey = (Constants.expoConfig?.extra?.stripePublishableKey as string) ?? '';

export default function App() {
  return (
    <StripeProvider publishableKey={stripePublishableKey}>
      <StatusBar style="light" />
      <RootNavigator />
    </StripeProvider>
  );
}
