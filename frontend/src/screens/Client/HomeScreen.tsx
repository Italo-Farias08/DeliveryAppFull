import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchBar } from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';
import { getCategories, getRestaurants } from '../../services/restaurantService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Category, Restaurant } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 20;
const BANNER_WIDTH = SCREEN_WIDTH - H_PAD * 2;
const BANNER_HEIGHT = 170;

// Imagens de comida usadas enquanto o backend não manda foto real do
// restaurante (ou se a URL vier quebrada). Quando o banco de dados
// estiver populado com fotos de verdade, isso deixa de ser necessário.
const FOOD_FALLBACKS = [
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80', // pizza
  'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=80', // burger
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80', // sushi
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80', // massa
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80', // salada
];
function getShortName(fullName?: string) {
  if (!fullName) return undefined;
  return fullName.trim().split(/\s+/).slice(0, 2).join(' ');
}

function getFallbackImage(id: string) {
  // hash simples pra sempre cair na mesma imagem pro mesmo restaurante
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return { uri: FOOD_FALLBACKS[hash % FOOD_FALLBACKS.length] };
}

// FlatList "animável" — necessário para o onScroll funcionar com useNativeDriver.
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList;

// ---------------------------------------------------------------------------
// Promo carousel — drop your own artwork in place of these placeholders.
// Add the files at the paths below (any real image, same filenames) and
// everything else (loop, dots, swipe) already works.
// ---------------------------------------------------------------------------
const BANNERS = [
  { id: 'promo-1', image: require('../../img/banners/banner_promocional_delivery_v2.png') },
  { id: 'promo-2', image: require('../../img/banners/banner_promocional_2.png') },
  { id: 'promo-3', image: require('../../img/banners/banner_promocional_3.png') },
];

function PromoCarousel() {
  const listRef = useRef<FlatList>(null);
  const indexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % BANNERS.length;
      listRef.current?.scrollToOffset({
        offset: indexRef.current * (BANNER_WIDTH + 12),
        animated: true,
      });
      setActiveIndex(indexRef.current);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const onMomentumEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (BANNER_WIDTH + 12));
    indexRef.current = idx;
    setActiveIndex(idx);
  };

  return (
    <View>
      <FlatList
        ref={listRef}
        data={BANNERS}
        horizontal
        snapToInterval={BANNER_WIDTH + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <Image source={item.image} style={styles.bannerImage} resizeMode="cover" />
        )}
      />
      <View style={styles.dotsRow}>
        {BANNERS.map((b, i) => (
          <View key={b.id} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Category chip — circular icon + label, matches the mockup's ring highlight.
// Used in the normal (non-scrolled) position, above the promo carousel.
// ---------------------------------------------------------------------------
function CategoryChip({
  name,
  icon,
  active,
  onPress,
}: {
  name: string;
  icon: any;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.categoryChip} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.categoryCircle, active && styles.categoryCircleActive]}>
        <Ionicons name={icon} size={24} color={active ? colors.primary : colors.textMuted} />
      </View>
      <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Compact category chip — texto num "pill" retangular, sem círculo, usado só
// na barra fixa (sticky) que aparece quando o usuário rola a tela pra baixo.
// Ocupa bem menos altura que a versão circular.
// ---------------------------------------------------------------------------
function CompactCategoryChip({
  name,
  active,
  onPress,
}: {
  name: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.compactChip, active && styles.compactChipActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.compactChipText, active && styles.compactChipTextActive]} numberOfLines={1}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Restaurant card — compacto, pensado para grid de 2 colunas.
// NOTE: field names (imageUrl, rating, deliveryTimeMin/Max, deliveryFee) are
// a best guess — if your Restaurant type uses different names, send me
// types.ts and I'll line these up exactly.
// ---------------------------------------------------------------------------
function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const fade = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    const delay = Math.min(index, 6) * 70;
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, delay, useNativeDriver: true, friction: 8, tension: 60 }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity: fade, transform: [{ translateY: translate }] }}>{children}</Animated.View>;
}

function RestaurantListCard({ restaurant, onPress }: { restaurant: any; onPress: () => void }) {
  const [favorite, setFavorite] = useState(false);
  const [imgError, setImgError] = useState(false);

  const hasImage = !!restaurant.imageUrl && !imgError;
  const imageSource = hasImage ? { uri: restaurant.imageUrl } : getFallbackImage(restaurant.id);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View>
        <Image
          source={imageSource}
          style={styles.cardImage}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={() => setFavorite((f) => !f)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{restaurant.name}</Text>
        <View style={styles.cardRow}>
          <Ionicons name="star" size={12} color={colors.star} />
          <Text style={styles.cardRating}>{restaurant.rating?.toFixed(1) ?? '—'}</Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="bicycle-outline" size={12} color={colors.textMuted} />
          <Text style={styles.cardMeta} numberOfLines={1}>
            {restaurant.deliveryTimeMin}–{restaurant.deliveryTimeMax} min
          </Text>
        </View>
        <Text style={styles.cardFee}>R$ {restaurant.deliveryFee?.toFixed(2) ?? '0.00'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Header completo da lista (saudação, busca, endereço, categorias, banner e
// título da seção). Fica em React.memo de propósito: o HomeScreen re-renderiza
// a cada mudança do scroll (pra saber quando mostrar a barra fixa), e sem o
// memo isso remontava o carrossel de banners a cada frame, travando-o.
// ---------------------------------------------------------------------------
const ListHeader = React.memo(function ListHeader({
  userName,
  categories,
  activeCategory,
  onSelectCategory,
  onNavigateSearch,
  onMeasureCategories,
  locationText,
  locationLoading,
  onPressLocation,
}: {
  userName?: string;
  categories: Category[];
  activeCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  onNavigateSearch: () => void;
  onMeasureCategories: (y: number) => void;
  locationText: string;
  locationLoading: boolean;
  onPressLocation: () => void;
}) {
  return (
    <View>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.logo}>Vitória Delivery</Text>
          {userName ? <Text style={styles.greeting}>Olá, {userName} 👋</Text> : null}
        </View>
        <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchBar editable={false} onPress={onNavigateSearch} placeholder="Buscar restaurantes ou comidas" />
        </View>
        <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Address selector */}
      <TouchableOpacity style={styles.locationRow} activeOpacity={0.7} onPress={onPressLocation}>
        <Ionicons name="location" size={15} color={colors.primary} />
        <Text style={styles.locationText} numberOfLines={1}>
          {locationLoading ? 'Buscando localização...' : locationText}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Categorias (versão normal, circular) — a posição Y daqui é o
          gatilho pra mostrar a barra fixa e compacta lá embaixo */}
      <View style={styles.categoriesRow} onLayout={(e) => onMeasureCategories(e.nativeEvent.layout.y)}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <CategoryChip
            name="Tudo"
            icon="grid-outline"
            active={activeCategory === null}
            onPress={() => onSelectCategory(null)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              name={c.name}
              icon={c.icon as any}
              active={activeCategory === c.id}
              onPress={() => onSelectCategory(c.id)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={styles.contentPad}>
        <View style={{ marginTop: 18 }}>
          <PromoCarousel />
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Restaurantes</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <View style={styles.seeAllRow}>
              <Text style={styles.seeAllText}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  // Posição (Y) de onde começa a fileira de categorias dentro do header —
  // é o ponto que usamos pra saber quando trocar pra barra fixa e compacta.
  const [categoriesY, setCategoriesY] = useState<number | null>(null);
  const [showStickyCategories, setShowStickyCategories] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const [locationText, setLocationText] = useState('Toque para definir localização');
  const [locationLoading, setLocationLoading] = useState(false);

  const fetchLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationText('Permissão de localização negada');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (place) {
        const street = place.street || place.name;
        const number = place.streetNumber;
        const neighborhood = place.district || place.subregion;
        const parts = [street && number ? `${street}, ${number}` : street, neighborhood].filter(Boolean);
        setLocationText(parts.length ? parts.join(' - ') : 'Localização encontrada');
      } else {
        setLocationText('Não foi possível identificar o endereço');
      }
    } catch (err) {
      setLocationText('Não foi possível obter sua localização');
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    getRestaurants(activeCategory ?? undefined)
      .then(setRestaurants)
      .finally(() => setLoading(false));
  }, [activeCategory]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (e: any) => {
        if (categoriesY == null) return;
        const y = e.nativeEvent.contentOffset.y;
        const shouldShow = y > categoriesY;
        setShowStickyCategories((prev) => (prev === shouldShow ? prev : shouldShow));
      },
    }
  );

  const goToSearch = useCallback(() => navigation.navigate('Search'), [navigation]);
  const handleMeasureCategories = useCallback((y: number) => setCategoriesY(y), []);

  const stickyThreshold = categoriesY ?? 99999;
  const stickyOpacity = scrollY.interpolate({
    inputRange: [Math.max(stickyThreshold - 1, 0), stickyThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const stickyTranslate = scrollY.interpolate({
    inputRange: [Math.max(stickyThreshold - 1, 0), stickyThreshold],
    outputRange: [-12, 0],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AnimatedFlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <ListHeader
            userName={getShortName(user?.name)}
            categories={categories}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            onNavigateSearch={goToSearch}
            onMeasureCategories={handleMeasureCategories}
            locationText={locationText}
            locationLoading={locationLoading}
            onPressLocation={fetchLocation}
          />
        }
        renderItem={({ item, index }) => (
          <View style={styles.gridItem}>
            <AnimatedCard index={index}>
              <RestaurantListCard
                restaurant={item}
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}
              />
            </AnimatedCard>
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum restaurante nessa categoria ainda.</Text>
            </View>
          ) : null
        }
      />

      {/* Barra de categorias fixa e compacta — some/aparece sozinha conforme
          o scroll passa (ou volta a ficar acima) do ponto das categorias
          originais. Fica por cima do conteúdo, sem ocupar espaço extra. */}
      <Animated.View
        pointerEvents={showStickyCategories ? 'auto' : 'none'}
        style={[
          styles.stickyBar,
          {
            paddingTop: insets.top + 8,
            opacity: stickyOpacity,
            transform: [{ translateY: stickyTranslate }],
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stickyBarContent}
        >
          <CompactCategoryChip
            name="Tudo"
            active={activeCategory === null}
            onPress={() => setActiveCategory(null)}
          />
          {categories.map((c) => (
            <CompactCategoryChip
              key={c.id}
              name={c.name}
              active={activeCategory === c.id}
              onPress={() => setActiveCategory(c.id)}
            />
          ))}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingBottom: 30 },
  columnWrapper: { justifyContent: 'space-between', paddingHorizontal: H_PAD },

  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
  },
  logo: { fontSize: 24, fontWeight: '800', color: colors.primary },
  greeting: { fontSize: 12.5, color: colors.textMuted, marginTop: 2, fontWeight: '600' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: H_PAD,
    marginTop: 14,
  },
  filterBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: H_PAD,
    marginTop: 12,
  },
  locationText: { fontSize: 13, color: colors.text, fontWeight: '600' },

  contentPad: { paddingHorizontal: H_PAD },

  categoriesRow: { paddingHorizontal: H_PAD, marginTop: 14 },

  categoryChip: { alignItems: 'center', width: 68, marginRight: 6 },
  categoryCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCircleActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  categoryLabel: { fontSize: 11.5, color: colors.textMuted, marginTop: 6, fontWeight: '600' },
  categoryLabelActive: { color: colors.primary },

  // --- barra fixa (sticky) compacta ---
  stickyBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 20,
  },
  stickyBarContent: { paddingHorizontal: H_PAD, gap: 8, flexDirection: 'row' },
  compactChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  compactChipText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  compactChipTextActive: { color: colors.white },

  bannerImage: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: colors.border,
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary, width: 18 },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: { ...typography.h2, color: colors.text },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 13, color: colors.primary, fontWeight: '700' },

  // --- grid ---
  gridItem: {
    width: '48%',
    marginBottom: 4,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardImage: { width: '100%', height: 90, backgroundColor: colors.border },
  favoriteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: 8 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  cardRating: { fontSize: 11, color: colors.text, fontWeight: '700' },
  cardMeta: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  cardFee: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 2 },

  emptyState: { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
});