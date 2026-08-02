import { NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import DelivererHomeScreen from '../screens/Deliverer/DelivererHomeScreen';
import RestaurantHomeScreen from '../screens/Restaurant/RestaurantHomeScreen';
import { colors } from '../theme/colors';
import AuthNavigator from './AuthNavigator';
import ClientNavigator from './ClientNavigator';

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user && <AuthNavigator />}
      {user?.role === 'client' && <ClientNavigator />}
      {user?.role === 'restaurant' && <RestaurantHomeScreen />}
      {user?.role === 'deliverer' && <DelivererHomeScreen />}
    </NavigationContainer>
  );
}
