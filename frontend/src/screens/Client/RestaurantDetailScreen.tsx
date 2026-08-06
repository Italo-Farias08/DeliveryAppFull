import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodCard } from '../../components/FoodCard';
import { useCart } from '../../context/CartContext';
import { getRestaurantById } from '../../services/restaurantService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Restaurant } from '../../types';

// altura do banner calculada a partir da largura da tela (proporção 4:3),
// assim o enquadramento da foto fica sempre consistente, em qualquer
// aparelho, sem cortar de forma estranha
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_HEIGHT = SCREEN_WIDTH * 0.75;

export default function RestaurantDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { restaurantId } = route.params;
  const { addItem, totalItems, subtotal, restaurantId: cartRestaurantId } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

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
  const menuCategories = restaurant.menuCategories || [];
  const filteredMenu = activeCategoryId
    ? restaurant.menu.filter((item) => item.categoryId === activeCategoryId)
    : restaurant.menu;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* barra de status transparente, ícones do sistema em branco,
          por cima da foto de capa -- sem faixa branca no topo */}
      <StatusBar style="light" translucent />

      <ScrollView contentContainerStyle={{ paddingBottom: showCartBar ? 100 : 30 }}>
        {/* ---- BANNER com texto sobreposto, indo até o topo real da tela ---- */}
        <View style={styles.coverWrapper}>
          <View style={styles.coverClip}>
            <Image
              source={{ uri: restaurant.banner || restaurant.image }}
              style={styles.cover}
              contentFit="cover"
              contentPosition="center"
              cachePolicy="memory-disk"
              transition={150}
            />

            {/* degradê escuro para o texto e os ícones do sistema ficarem legíveis */}
            <LinearGradient
              colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)']}
              locations={[0, 0.45, 1]}
              style={styles.coverOverlay}
            />
          </View>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { top: insets.top + 10 }]}
          >
            <Ionicons name="arrow-back" size={20} color={colors.text} />
          </TouchableOpacity>

          {/* nome + tagline, desenhados por cima do banner */}
          <View style={styles.coverContent}>
            <View style={styles.flameBadge}>
              <Ionicons name="flame" size={22} color="#FFB020" />
            </View>
            <Text style={styles.coverTitle}>{restaurant.name}</Text>
            <Text style={styles.coverTagline}></Text>
          </View>

          {!!restaurant.image && (
            <Image source={{ uri: restaurant.image }} style={styles.logoAvatar} contentFit="cover" cachePolicy="memory-disk" />
          )}
        </View>

        <View style={[styles.infoBlock, !!restaurant.image && { marginTop: 46 }]}>
          <Text style={styles.name}>{restaurant.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="star" size={14} color={colors.star} />
            <Text style={styles.metaText}>{restaurant.rating.toFixed(1)}</Text>
            <Text style={styles.dot}>-</Text>
            <View style={styles.metaIconGroup}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={styles.metaText}>{restaurant.deliveryTimeMin}-{restaurant.deliveryTimeMax} min</Text>
            </View>
            <Text style={styles.dot}>-</Text>
            <View style={styles.metaIconGroup}>
              <MaterialCommunityIcons name="moped" size={16} color={colors.textMuted} />
              <Text style={styles.metaText}>R$ {restaurant.deliveryFee.toFixed(2)}</Text>
            </View>
          </View>
          {!restaurant.isOpen && (
            <View style={styles.closedNotice}>
              <Text style={styles.closedNoticeText}>Este restaurante está fechado no momento</Text>
            </View>
          )}
        </View>

        <View style={styles.menuBlock}>
          <Text style={styles.sectionTitle}>Cardápio</Text>

          {menuCategories.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              <TouchableOpacity
                style={[styles.chip, !activeCategoryId && styles.chipActive]}
                onPress={() => setActiveCategoryId(null)}
              >
                <Text style={[styles.chipText, !activeCategoryId && styles.chipTextActive]}>Todos</Text>
              </TouchableOpacity>
              {menuCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.chip, activeCategoryId === cat.id && styles.chipActive]}
                  onPress={() => setActiveCategoryId(cat.id)}
                >
                  <Text style={[styles.chipText, activeCategoryId === cat.id && styles.chipTextActive]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {filteredMenu.length === 0 ? (
            <Text style={styles.emptyMenuText}>Nenhum item nessa categoria ainda.</Text>
          ) : (
            filteredMenu.map((item) => (
              <FoodCard key={item.id} item={item} onAdd={() => addItem(item)} />
            ))
          )}
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
  coverWrapper: { width: '100%', height: COVER_HEIGHT },
  coverClip: { width: '100%', height: '100%', overflow: 'hidden' },
  cover: { width: '100%', height: '100%', backgroundColor: colors.border },
  coverOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  backBtn: {
    position: 'absolute', left: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },
  coverContent: {
    position: 'absolute', left: 20, right: 20, bottom: 44,
  },
  flameBadge: { marginBottom: 6 },
  coverTitle: {
    ...typography.display,
    color: colors.white,
    fontSize: 26,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  coverTagline: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    opacity: 0.9,
  },
  logoAvatar: {
    position: 'absolute', bottom: -42, left: 20,
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderColor: colors.background,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  infoBlock: { padding: 20, paddingBottom: 8 },
  name: { ...typography.display, fontSize: 24, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  metaIconGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  dot: { color: colors.textMuted },
  closedNotice: { backgroundColor: colors.primaryLight, padding: 10, borderRadius: 10, marginTop: 12 },
  closedNoticeText: { color: colors.primaryDark, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  menuBlock: { paddingHorizontal: 20, marginTop: 12 },
  sectionTitle: { ...typography.h2, color: colors.text, marginBottom: 14 },
  chipsRow: { gap: 8, paddingBottom: 16 },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  emptyMenuText: { color: colors.textMuted, fontSize: 13.5, textAlign: 'center', paddingVertical: 20 },
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