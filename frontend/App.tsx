import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { OrderProvider } from './src/context/OrderContext';
import { FavoritesProvider } from './src/context/FavoritesContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <OrderProvider>
              <FavoritesProvider>
                {/* translucent + backgroundColor transparent: a área de status
                    (bateria, wifi, relógio) deixa de ter aquela faixa branca
                    genérica e passa a herdar a cor de fundo de cada tela, que
                    já é pintada por baixo pelo SafeAreaView de cada uma. */}
                <StatusBar style="dark" translucent backgroundColor="transparent" />
                <RootNavigator />
              </FavoritesProvider>
            </OrderProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}