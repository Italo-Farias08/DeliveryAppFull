import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { RestaurantProvider, useRestaurantPanel } from '../context/RestaurantContext';
import RestaurantDashboardScreen from '../screens/Restaurant/RestaurantDashboardScreen';
import RestaurantDeliverersScreen from '../screens/Restaurant/RestaurantDeliverersScreen';
import RestaurantHoursScreen from '../screens/Restaurant/RestaurantHoursScreen';
import RestaurantLocationScreen from '../screens/Restaurant/RestaurantLocationScreen';
import RestaurantMenuScreen from '../screens/Restaurant/RestaurantMenuScreen';
import RestaurantOutOfStockScreen from '../screens/Restaurant/RestaurantOutOfStockScreen';
import RestaurantOnboardingScreen from '../screens/Restaurant/RestaurantOnboardingScreen';
import RestaurantOrdersScreen from '../screens/Restaurant/RestaurantOrdersScreen';
import RestaurantSalesScreen from '../screens/Restaurant/RestaurantSalesScreen';
import RestaurantSettingsScreen from '../screens/Restaurant/RestaurantSettingsScreen';
import { useTheme } from '../context/ThemeContext';

const Stack = createNativeStackNavigator();

function RestaurantNavigatorInner() {
  const { colors } = useTheme();
  const { loadingInit, restaurant } = useRestaurantPanel();

  if (loadingInit) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!restaurant) {
    return <RestaurantOnboardingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={RestaurantDashboardScreen} />
      <Stack.Screen name="Orders" component={RestaurantOrdersScreen} />
      <Stack.Screen name="Sales" component={RestaurantSalesScreen} />
      <Stack.Screen name="Menu" component={RestaurantMenuScreen} />
      <Stack.Screen name="OutOfStock" component={RestaurantOutOfStockScreen} />
      <Stack.Screen name="Location" component={RestaurantLocationScreen} />
      <Stack.Screen name="Hours" component={RestaurantHoursScreen} />
      <Stack.Screen name="Deliverers" component={RestaurantDeliverersScreen} />
      <Stack.Screen name="Settings" component={RestaurantSettingsScreen} />
    </Stack.Navigator>
  );
}

export default function RestaurantNavigator() {
  return (
    <RestaurantProvider>
      <RestaurantNavigatorInner />
    </RestaurantProvider>
  );
}