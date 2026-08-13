import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useCart } from '../context/CartContext';
import AccountScreen from '../screens/Client/AccountScreen';
import AddressesScreen from '../screens/Client/AddressesScreen';
import MyDataScreen from '../screens/Client/MyDataScreen';
import FavoritesScreen from '../screens/Client/FavoritesScreen';
import HelpScreen from '../screens/Client/HelpScreen';
import CartScreen from '../screens/Client/CartScreen';
import HomeScreen from '../screens/Client/HomeScreen';
import OrdersScreen from '../screens/Client/OrdersScreen';
import RestaurantDetailScreen from '../screens/Client/RestaurantDetailScreen';
import SearchScreen from '../screens/Client/SearchScreen';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();
const HomeStackNav = createNativeStackNavigator();
const OrdersStackNav = createNativeStackNavigator();
const AccountStackNav = createNativeStackNavigator();

function HomeStack() {
  return (
    <HomeStackNav.Navigator screenOptions={{ headerShown: false }}>
      <HomeStackNav.Screen name="HomeMain" component={HomeScreen} />
      <HomeStackNav.Screen
        name="Search"
        component={SearchScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <HomeStackNav.Screen name="RestaurantDetail" component={RestaurantDetailScreen} />
      <HomeStackNav.Screen name="Cart" component={CartScreen} />
    </HomeStackNav.Navigator>
  );
}

function OrdersStack() {
  return (
    <OrdersStackNav.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStackNav.Screen name="OrdersMain" component={OrdersScreen} />
    </OrdersStackNav.Navigator>
  );
}

// Nova stack da aba Conta: tela principal + tela de endereços
// (Casa, Trabalho, Outro), aberta pelo botão "Endereços".
function AccountStack() {
  return (
    <AccountStackNav.Navigator screenOptions={{ headerShown: false }}>
      <AccountStackNav.Screen name="AccountMain" component={AccountScreen} />
      <AccountStackNav.Screen name="Addresses" component={AddressesScreen} />
      <AccountStackNav.Screen name="MyData" component={MyDataScreen} />
      <AccountStackNav.Screen name="Favorites" component={FavoritesScreen} />
      <AccountStackNav.Screen name="Help" component={HelpScreen} />
    </AccountStackNav.Navigator>
  );
}

export default function ClientNavigator() {
  const { totalItems } = useCart();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { borderTopColor: colors.border, height: 60, paddingBottom: 8, paddingTop: 8 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            Orders: 'receipt',
            Account: 'person',
          };
          return <Ionicons name={icons[route.name] ?? 'ellipse'} size={size - 2} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} options={{ title: 'Início' }} />
      <Tab.Screen name="Orders" component={OrdersStack} options={{ title: 'Pedidos' }} />
      <Tab.Screen name="Account" component={AccountStack} options={{ title: 'Conta' }} />
    </Tab.Navigator>
  );
}