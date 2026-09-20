import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';

import { AuthStackParamList, DriverStackParamList, RiderStackParamList } from './types';

import WelcomeScreen from '../screens/auth/WelcomeScreen';
import EmailAuthScreen from '../screens/auth/EmailAuthScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

import RiderMapScreen from '../screens/rider/RiderMapScreen';
import DestinationPickerScreen from '../screens/rider/DestinationPickerScreen';
import RideConfirmScreen from '../screens/rider/RideConfirmScreen';
import LiveTripScreen from '../screens/rider/LiveTripScreen';
import RideHistoryScreen from '../screens/rider/RideHistoryScreen';

import DriverDashboardScreen from '../screens/driver/DriverDashboardScreen';
import DriverTripScreen from '../screens/driver/DriverTripScreen';

import ProfileScreen from '../screens/shared/ProfileScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RiderStack = createNativeStackNavigator<RiderStackParamList>();
const DriverStack = createNativeStackNavigator<DriverStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.text,
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={screenOptions}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="EmailAuth" component={EmailAuthScreen} options={{ title: '' }} />
      <AuthStack.Screen
        name="ProfileSetup"
        component={ProfileSetupScreen}
        options={{ title: '', headerBackVisible: false }}
      />
    </AuthStack.Navigator>
  );
}

function RiderNavigator() {
  return (
    <RiderStack.Navigator screenOptions={screenOptions}>
      <RiderStack.Screen name="RiderMap" component={RiderMapScreen} options={{ headerShown: false }} />
      <RiderStack.Screen name="DestinationPicker" component={DestinationPickerScreen} options={{ headerShown: false }} />
      <RiderStack.Screen name="RideConfirm" component={RideConfirmScreen} options={{ headerShown: false }} />
      <RiderStack.Screen
        name="LiveTrip"
        component={LiveTripScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <RiderStack.Screen name="RideHistory" component={RideHistoryScreen} options={{ title: '' }} />
      <RiderStack.Screen name="Profile" component={ProfileScreen} options={{ title: '' }} />
    </RiderStack.Navigator>
  );
}

function DriverNavigator() {
  return (
    <DriverStack.Navigator screenOptions={screenOptions}>
      <DriverStack.Screen name="DriverDashboard" component={DriverDashboardScreen} options={{ headerShown: false }} />
      <DriverStack.Screen
        name="DriverTrip"
        component={DriverTripScreen}
        options={{ headerShown: false, gestureEnabled: false }}
      />
      <DriverStack.Screen name="Profile" component={ProfileScreen} options={{ title: '' }} />
    </DriverStack.Navigator>
  );
}

export default function RootNavigator() {
  const { loading, firebaseUser, profile } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!firebaseUser || !profile ? (
        <AuthNavigator />
      ) : profile.role === 'driver' ? (
        <DriverNavigator />
      ) : (
        <RiderNavigator />
      )}
    </NavigationContainer>
  );
}
