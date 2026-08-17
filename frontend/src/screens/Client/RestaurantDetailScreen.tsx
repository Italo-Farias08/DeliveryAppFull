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
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FoodCard } from '../../components/FoodCard';
import { AddonsModal } from '../../components/AddonsModal';
import SwitchRestaurantModal from '../../components/SwitchRestaurantModal';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { PressableScale } from '../../components/PressableScale';
import { useCart } from '../../context/CartContext';
import { getRestaurantById } from '../../services/restaurantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows, coloredShadow } from '../../theme/shadows';
import { Addon, MenuItem, Restaurant } from '../../types';
import { formatRating } from '../../utils/rating';

// altura do banner calculada a partir da largura da tela (proporção 4:3),
// assim o enquadramento da foto fica sempre consistente, em qualquer
// aparelho, sem cortar de forma estranha
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COVER_HEIGHT = SCREEN_WIDTH * 0.75;

export default function RestaurantDetailScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { restaurantId } = route.params;
  const { addItem, totalItems, subtotal, restaurantId: cartRestaurantId } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [addonsItem, setAddonsItem] = useState<MenuItem | null>(null);
  const [pendingSwitchItem, setPendingSwitchItem] = useState<MenuItem | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    getRestaurantById(restaurantId).then((r) => setRestaurant(r ?? null));
  }, [restaurantId]);

  // Sempre abre o modal ao tocar em "+" -- mesmo pra itens sem adicionais
  // cadastrados -- porque é nele que o cliente também pode escrever uma
  // observação pro item (ex: "sem cebola").
  function openItemFlow(item: MenuItem) {
    setAddonsItem(item);
  }

  // Carrinho é de um restaurante por vez -- se já tem itens de outro
  // lugar, avisa ANTES de trocar (em vez de apagar sem o cliente saber).
  function handleAdd(item: MenuItem) {
    if (!restaurant) return;
    if (cartRestaurantId && cartRestaurantId !== restaurant.id) {
      setPendingSwitchItem(item);
      return;
    }
    openItemFlow(item);
  }

  function handleConfirmSwitch() {
    const item = pendingSwitchItem;
    setPendingSwitchItem(null);
    if (item) openItemFlow(item);
  }

  function handleConfirmAddons(selectedAddons: Addon[], qty: number, notes: string) {
    if (!addonsItem) return;
    for (let i = 0; i < qty; i++) addItem(addonsItem, selectedAddons, notes);
    setAddonsItem(null);
  }

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
    // edges={[]} DE PROPÓSITO: a barra de tabs (Início/Pedidos/Conta) já
    // reserva o espaço seguro embaixo — se a gente também pedir edges:
    // ['bottom'] aqui, o inset é somado duas vezes e sobra uma faixa
    // branca grossa em cima dos botões da tab bar. 'top' também fica de
    // fora de propósito, pra o banner poder ir até debaixo da status bar.
    <SafeAreaView style={styles.safe} edges={[]}>
      {/* barra de status transparente, ícones do sistema em branco,
          por cima da foto de capa -- sem faixa branca no topo */}
      <StatusBar style="light" translucent />

      <ScrollView contentContainerStyle={{ paddingBottom: showCartBar ? 88 : 24 }}>
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

          {/* Posicionamento absoluto fica NESTE View, não dentro do
              PressableScale: o Animated.View interno do PressableScale
              tem tamanho zero (só o ícone), então se ele receber
              position:absolute, o botão fica relativo a esse wrapper
              zerado -- que entra no fluxo normal logo depois da imagem
              (altura 100%) e acaba empurrado pra baixo da foto. Aqui a
              View externa é quem fica absoluta sobre a capa; o
              PressableScale só cuida do toque/animação por dentro. */}
          <View style={[styles.backBtnWrap, { top: insets.top + 10 }]}>
            <PressableScale onPress={() => navigation.goBack()} style={styles.backBtn} scaleTo={0.88}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </PressableScale>
          </View>

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
            {(() => {
              const ratingDisplay = formatRating(restaurant.rating, restaurant.ratingCount);
              return ratingDisplay ? (
                <>
                  <Ionicons name="star" size={14} color={colors.star} />
                  <Text style={styles.metaText}>{ratingDisplay}</Text>
                  <Text style={styles.metaTextMuted}>({restaurant.ratingCount})</Text>
                </>
              ) : (
                <Text style={styles.metaText}>Novo por aqui</Text>
              );
            })()}
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
              <PressableScale
                style={[styles.chip, !activeCategoryId && styles.chipActive]}
                onPress={() => setActiveCategoryId(null)}
                scaleTo={0.93}
              >
                <Text style={[styles.chipText, !activeCategoryId && styles.chipTextActive]}>Todos</Text>
              </PressableScale>
              {menuCategories.map((cat) => (
                <PressableScale
                  key={cat.id}
                  style={[styles.chip, activeCategoryId === cat.id && styles.chipActive]}
                  onPress={() => setActiveCategoryId(cat.id)}
                  scaleTo={0.93}
                >
                  <Text style={[styles.chipText, activeCategoryId === cat.id && styles.chipTextActive]}>
                    {cat.name}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          )}

          {filteredMenu.length === 0 ? (
            <Text style={styles.emptyMenuText}>Nenhum item nessa categoria ainda.</Text>
          ) : (
            filteredMenu.map((item, i) => (
              <FadeSlideIn key={item.id} index={i}>
                <FoodCard item={item} onAdd={() => handleAdd(item)} />
              </FadeSlideIn>
            ))
          )}
        </View>
      </ScrollView>

      {showCartBar && (
        <FadeSlideIn style={styles.cartBarWrap} distance={30}>
          <PressableScale style={styles.cartBar} onPress={() => navigation.navigate('Cart')} scaleTo={0.97}>
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalItems}</Text>
            </View>
            <Text style={styles.cartBarText}>Ver carrinho</Text>
            <Text style={styles.cartBarTotal}>R$ {subtotal.toFixed(2)}</Text>
          </PressableScale>
        </FadeSlideIn>
      )}

      <AddonsModal
        visible={!!addonsItem}
        item={addonsItem}
        onClose={() => setAddonsItem(null)}
        onConfirm={handleConfirmAddons}
      />

      <SwitchRestaurantModal
        visible={!!pendingSwitchItem}
        onCancel={() => setPendingSwitchItem(null)}
        onConfirm={handleConfirmSwitch}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  coverWrapper: { width: '100%', height: COVER_HEIGHT },
  coverClip: { width: '100%', height: '100%', overflow: 'hidden' },
  cover: { width: '100%', height: '100%', backgroundColor: colors.border },
  coverOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  backBtnWrap: {
    position: 'absolute', left: 14,
    zIndex: 2,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.sm,
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
  metaTextMuted: { fontSize: 11.5, color: colors.textMuted, marginLeft: -4 },
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
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary, ...coloredShadow(colors.primary, 0.28) },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.white },
  emptyMenuText: { color: colors.textMuted, fontSize: 13.5, textAlign: 'center', paddingVertical: 20 },
  cartBarWrap: { position: 'absolute', bottom: 16, left: 20, right: 20 },
  cartBar: {
    height: 56,
    backgroundColor: colors.secondary, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10,
    ...coloredShadow(colors.secondary, 0.35),
  },
  cartBadge: { backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  cartBadgeText: { color: colors.secondary, fontWeight: '800', fontSize: 12.5 },
  cartBarText: { color: colors.white, fontWeight: '700', flex: 1, fontSize: 15 },
  cartBarTotal: { color: colors.white, fontWeight: '800', fontSize: 15 },
});
};