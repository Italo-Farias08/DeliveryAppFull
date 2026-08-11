import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { OrderProvider } from './src/context/OrderContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import RootNavigator from './src/navigation/RootNavigator';
import { USE_MOCK, API_BASE_URL } from './src/services/api';

// Aviso visível quando o app está rodando com dados fictícios (mock).
// Existe pra isso NUNCA mais passar despercebido: se o .env sumir ou vier
// com EXPO_PUBLIC_USE_MOCK=true por engano, você vê na hora, em vez de
// ficar sem entender por que aparecem restaurantes/pedidos que não existem.
function MockModeBanner() {
  if (!USE_MOCK) return null;
  return (
    <View style={{ backgroundColor: '#B91C1C', paddingVertical: 4, paddingTop: 44, alignItems: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
        ⚠️ MODO MOCK ATIVO — dados fictícios, não é o backend real
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <OrderProvider>
              <FavoritesProvider>
                <NotificationsProvider>
                  {/* translucent + backgroundColor transparent: a área de status
                      (bateria, wifi, relógio) deixa de ter aquela faixa branca
                      genérica e passa a herdar a cor de fundo de cada tela, que
                      já é pintada por baixo pelo SafeAreaView de cada uma. */}
                  <StatusBar style="dark" translucent backgroundColor="transparent" />
                  <MockModeBanner />
                  <RootNavigator />
                </NotificationsProvider>
              </FavoritesProvider>
            </OrderProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}