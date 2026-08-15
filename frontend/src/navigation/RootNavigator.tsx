import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import DelivererHomeScreen from '../screens/Deliverer/DelivererHomeScreen';
import { useTheme } from '../context/ThemeContext';
import AuthNavigator from './AuthNavigator';
import ClientNavigator from './ClientNavigator';
import RestaurantNavigator from './RestaurantNavigator';

export default function RootNavigator() {
  const { colors, isDark } = useTheme();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Sem isso, o fundo "de baixo" que aparece durante a transição entre
  // telas continua branco mesmo no modo escuro (o NavigationContainer tem
  // seu próprio tema, independente do nosso ThemeProvider).
  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      primary: colors.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {!user && <AuthNavigator />}
      {user?.role === 'client' && <ClientNavigator />}
      {user?.role === 'restaurant' && <RestaurantNavigator />}
      {user?.role === 'deliverer' && <DelivererHomeScreen />}
    </NavigationContainer>
  );
}
