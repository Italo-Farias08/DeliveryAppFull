import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FoodCard } from '../../components/FoodCard';
import { useCart } from '../../context/CartContext';
import { getRestaurantById } from '../../services/restaurantService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Restaurant } from '../../types';

export default function RestaurantDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { restaurantId } = route.params;
  const { addItem, totalItems, subtotal, restaurantId: cartRestaurantId } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  useEffect(() => {
    getRestaurantById(restaurantId).then((r) => setRestaurant(r ?? null));
  }, [restaurantId]);

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const showCartBar = totalItems > 0 && cartRestaurantId === restaurant.id;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: showCartBar ? 100 : 30 }}>
        <View>
          <Image source={{ uri: restaurant.banner || restaurant.image }} style={styles.cover} />
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>
          {!!restaurant.image && (
            <Image source={{ uri: restaurant.image }} style={styles.logoAvatar} />
          )}
        </View>

        <View style={[styles.infoBlock, !!restaurant.image && { marginTop: 34 }]}>
          <Text style={styles.name}>{restaurant.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={14} color={colors.star} />
            <Text style={styles.metaText}>{restaurant.rating.toFixed(1)}</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.metaText}>{restaurant.deliveryTimeMin}-{restaurant.deliveryTimeMax} min</Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.metaText}>R$ {restaurant.deliveryFee.toFixed(2)} entrega</Text>
          </View>
          {!restaurant.isOpen && (
            <View style={styles.closedNotice}>
              <Text style={styles.closedNoticeText}>Este restaurante está fechado no momento</Text>
            </View>
          )}
        </View>

        <View style={styles.menuBlock}>
          <Text style={styles.sectionTitle}>Cardápio</Text>
          {restaurant.menu.map((item) => (
            <FoodCard key={item.id} item={item} onAdd={() => addItem(item)} />
          ))}
        </View>
      </ScrollView>

      {showCartBar && (
        <TouchableOpacity
          style={styles.cartBar}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Cart')}
        >
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalItems}</Text>
          </View>
          <Text style={styles.cartBarText}>Ver carrinho</Text>
          <Text style={styles.cartBarTotal}>R$ {subtotal.toFixed(2)}</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  cover: { width: '100%', height: 200, backgroundColor: colors.border },
  logoAvatar: {
    position: 'absolute', bottom: -30, left: 20,
    width: 68, height: 68, borderRadius: 18,
    borderWidth: 3, borderColor: colors.background,
    backgroundColor: colors.surface,
  },
  backBtn: {
    position: 'absolute', top: 14, left: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  infoBlock: { padding: 20, paddingBottom: 8 },
  name: { ...typography.display, fontSize: 24, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  metaText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  dot: { color: colors.textMuted },
  closedNotice: { backgroundColor: colors.primaryLight, padding: 10, borderRadius: 10, marginTop: 12 },
  closedNoticeText: { color: colors.primaryDark, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  menuBlock: { paddingHorizontal: 20, marginTop: 12 },
  sectionTitle: { ...typography.h2, color: colors.text, marginBottom: 14 },
  cartBar: {
    position: 'absolute', bottom: 16, left: 20, right: 20, height: 56,
    backgroundColor: colors.secondary, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 6 }, shadowRadius: 10, elevation: 6,
  },
  cartBadge: { backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  cartBadgeText: { color: colors.secondary, fontWeight: '800', fontSize: 12.5 },
  cartBarText: { color: colors.white, fontWeight: '700', flex: 1, fontSize: 15 },
  cartBarTotal: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
