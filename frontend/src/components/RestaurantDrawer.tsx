import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export type RestaurantRoute = 'Dashboard' | 'Orders' | 'Sales' | 'Menu' | 'Location' | 'Hours' | 'Settings';

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.8);

const ITEMS: { route: RestaurantRoute; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { route: 'Dashboard', label: 'Início', icon: 'home-outline' },
  { route: 'Orders', label: 'Pedidos', icon: 'receipt-outline' },
  { route: 'Sales', label: 'Vendas', icon: 'bar-chart-outline' },
  { route: 'Menu', label: 'Cardápio', icon: 'restaurant-outline' },
  { route: 'Location', label: 'Localização', icon: 'location-outline' },
  { route: 'Hours', label: 'Horário', icon: 'time-outline' },
  { route: 'Settings', label: 'Configuração', icon: 'settings-outline' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  active: RestaurantRoute;
  onNavigate: (route: RestaurantRoute) => void;
  onSignOut: () => void;
  restaurantName?: string;
  pendingCount?: number;
}

export default function RestaurantDrawer({
  visible,
  onClose,
  active,
  onNavigate,
  onSignOut,
  restaurantName,
  pendingCount = 0,
}: Props) {
  // Desliza da esquerda: o painel começa fora da tela (-DRAWER_WIDTH) e
  // anima até 0 ao abrir; o fundo escurece junto (fade separado, pra dar
  // sensação de profundidade em vez de tudo se mover junto).
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 240, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.panel, { width: DRAWER_WIDTH, transform: [{ translateX }] }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <View style={styles.header}>
              <View style={styles.logoCircle}>
                <Ionicons name="storefront" size={20} color={colors.white} />
              </View>
              <Text style={styles.restaurantName} numberOfLines={1}>{restaurantName || 'Painel'}</Text>
            </View>

            <View style={styles.itemsList}>
              {ITEMS.map((item) => {
                const isActive = item.route === active;
                return (
                  <TouchableOpacity
                    key={item.route}
                    style={[styles.item, isActive && styles.itemActive]}
                    onPress={() => onNavigate(item.route)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.icon}
                      size={19}
                      color={isActive ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.itemText, isActive && styles.itemTextActive]}>{item.label}</Text>
                    {item.route === 'Orders' && pendingCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{pendingCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.signOutItem} onPress={onSignOut} activeOpacity={0.7}>
                <Ionicons name="log-out-outline" size={19} color={colors.danger} />
                <Text style={styles.signOutText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  panel: {
    height: '100%',
    backgroundColor: colors.surface,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  logoCircle: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  restaurantName: { ...typography.bodyBold, color: colors.text, flex: 1, fontSize: 15.5 },

  itemsList: { paddingTop: 14, paddingHorizontal: 12, gap: 4 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14,
  },
  itemActive: { backgroundColor: colors.primaryLight },
  itemText: { color: colors.textMuted, fontSize: 14.5, fontWeight: '600', flex: 1 },
  itemTextActive: { color: colors.primary, fontWeight: '800' },
  badge: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '800' },

  footer: { marginTop: 'auto', paddingHorizontal: 12, paddingBottom: 8 },
  signOutItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14,
    borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6, paddingTop: 18,
  },
  signOutText: { color: colors.danger, fontSize: 14.5, fontWeight: '700' },
});