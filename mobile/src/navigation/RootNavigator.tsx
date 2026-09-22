import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import { useAuth } from '../hooks/useAuth';
import { LoadingScreen } from '../components/LoadingScreen';

import { AdminStackParamList, AuthStackParamList, DriverStackParamList, RiderStackParamList } from './types';
import { ADMIN_EMAIL } from '../config/admin';

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
import DriverEarningsScreen from '../screens/driver/DriverEarningsScreen';

import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminDriversScreen from '../screens/admin/AdminDriversScreen';
import AdminClientsScreen from '../screens/admin/AdminClientsScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';

import ProfileScreen from '../screens/shared/ProfileScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import BannedScreen from '../screens/shared/BannedScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RiderStack = createNativeStackNavigator<RiderStackParamList>();
const DriverStack = createNativeStackNavigator<DriverStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();

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
      <RiderStack.Screen name="Settings" component={SettingsScreen} options={{ title: '' }} />
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
      <DriverStack.Screen name="DriverEarnings" component={DriverEarningsScreen} options={{ title: '' }} />
      <DriverStack.Screen name="Profile" component={ProfileScreen} options={{ title: '' }} />
      <DriverStack.Screen name="Settings" component={SettingsScreen} options={{ title: '' }} />
    </DriverStack.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminStack.Navigator screenOptions={screenOptions}>
      <AdminStack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ headerShown: false }} />
      <AdminStack.Screen name="AdminDrivers" component={AdminDriversScreen} options={{ title: '' }} />
      <AdminStack.Screen name="AdminClients" component={AdminClientsScreen} options={{ title: '' }} />
      <AdminStack.Screen name="AdminReports" component={AdminReportsScreen} options={{ title: '' }} />
    </AdminStack.Navigator>
  );
}

export default function RootNavigator() {
  const { loading, firebaseUser, profile } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  // The admin account has no /users profile at all (it's created directly
  // in the Firebase console, not through sign-up) — checked by email
  // before anything else needs `profile` to exist.
  const isAdmin = firebaseUser?.email === ADMIN_EMAIL;

  return (
    <NavigationContainer>
      {!firebaseUser ? (
        <AuthNavigator />
      ) : isAdmin ? (
        <AdminNavigator />
      ) : !profile ? (
        <AuthNavigator />
      ) : profile.banned ? (
        <BannedScreen />
      ) : profile.role === 'driver' ? (
        <DriverNavigator />
      ) : (
        <RiderNavigator />
      )}
    </NavigationContainer>
  );
}
