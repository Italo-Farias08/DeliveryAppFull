import { useNavigation } from '@react-navigation/native';
import React, { ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useRestaurantPanel } from '../context/RestaurantContext';
import { colors } from '../theme/colors';
import RestaurantDrawer, { RestaurantRoute } from './RestaurantDrawer';
import RestaurantHeader from './RestaurantHeader';

interface Props {
  title: string;
  subtitle?: string;
  active: RestaurantRoute;
  headerRight?: ReactNode;
  children: ReactNode;
}

// Casca comum das telas do painel do restaurante: cabeçalho com o botão
// hambúrguer + a gaveta lateral (Início/Pedidos/Cardápio/Localização/
// Configuração), pra cada tela só precisar cuidar do próprio conteúdo.
export default function RestaurantScreenLayout({ title, subtitle, active, headerRight, children }: Props) {
  const navigation = useNavigation<any>();
  const { signOut } = useAuth();
  const { restaurant, pendingCount } = useRestaurantPanel();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleNavigate(route: RestaurantRoute) {
    setDrawerOpen(false);
    if (route !== active) navigation.navigate(route);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <RestaurantHeader
        title={title}
        subtitle={subtitle}
        onMenuPress={() => setDrawerOpen(true)}
        right={headerRight}
      />
      <View style={{ flex: 1 }}>{children}</View>

      <RestaurantDrawer
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        active={active}
        onNavigate={handleNavigate}
        onSignOut={signOut}
        restaurantName={restaurant?.name}
        pendingCount={pendingCount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
