import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import {
  Animated,
  Dimensions,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchBar } from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getCategories, getRestaurants } from '../../services/restaurantService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Category, Restaurant } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 20;

// Banner do carrossel promocional — agora com margem lateral (não cobre mais
// a tela inteira). BANNER_GAP é o espaço entre um banner e o próximo.
const BANNER_GAP = 12;
const BANNER_WIDTH = SCREEN_WIDTH - H_PAD * 2;
const BANNER_HEIGHT = 170;

// Imagem usada só se o restaurante não tiver NENHUMA foto própria (nem
// image, nem banner). Isso deve ser raro -- é só um último recurso.
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

// Emojis mais certeiros por categoria (bem mais vivos que ícone monocromático).
// Comparamos pelo NOME, não pelo id -- o id vem do banco (UUID) e muda a
// cada seed, mas o nome da categoria é sempre o mesmo.
const CATEGORY_EMOJIS: Record<string, string> = {
  'Hambúrguer': '🍔',
  'Pizza': '🍕',
  'Japonesa': '🍱',
  'Brasileira': '🍲',
  'Doces': '🧁',
  'Saudável': '🥗',
  'Bebidas': '🧋',
};
function getCategoryEmoji(name: string | null) {
  if (!name) return '🍽️'; // "Tudo"
  return CATEGORY_EMOJIS[name] ?? '🍴';
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
        offset: indexRef.current * (BANNER_WIDTH + BANNER_GAP),
        animated: true,
      });
      setActiveIndex(indexRef.current);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const onMomentumEnd = (e: any) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (BANNER_WIDTH + BANNER_GAP));
    indexRef.current = idx;
    setActiveIndex(idx);
  };

  return (
    <View>
      <FlatList
        ref={listRef}
        data={BANNERS}
        horizontal
        pagingEnabled
        snapToInterval={BANNER_WIDTH + BANNER_GAP}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingHorizontal: H_PAD }}
        renderItem={({ item }) => (
          <Image source={item.image} style={styles.bannerImage} contentFit="cover" />
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
  emoji,
  active,
  onPress,
}: {
  name: string;
  emoji: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.categoryChip} onPress={onPress} activeOpacity={0.75} hitSlop={{ top: 4, bottom: 4 }}>
      <View style={[styles.categoryCircle, active && styles.categoryCircleActive]}>
        <Text style={styles.categoryEmoji}>{emoji}</Text>
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
// Usa a LOGO do restaurante (restaurant.image), igual à tela de detalhes.
// Se um dia você quiser mostrar o banner/foto de capa em vez da logo aqui,
// troque `restaurant.image` por `restaurant.banner || restaurant.image`.
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

function RestaurantListCard({ restaurant, onPress }: { restaurant: Restaurant; onPress: () => void }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(restaurant.id);
  const [imgError, setImgError] = useState(false);

  // campo certo é `image` (a logo do restaurante) -- `imageUrl` não existe
  // no tipo Restaurant, então antes isso sempre caía no fallback aleatório.
  const hasImage = !!restaurant.image && !imgError;
  const imageSource = hasImage ? { uri: restaurant.image } : getFallbackImage(restaurant.id);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View>
        <Image
          source={imageSource}
          style={styles.cardImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setImgError(true)}
        />
        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={() => toggleFavorite(restaurant)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={15} color={colors.primary} />
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
  categoriesRowOpacity,
  categoriesRowTranslate,
  notificationsEnabled,
  onToggleNotifications,
  topRatedOnly,
  onToggleTopRated,
  topInset,
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
  categoriesRowOpacity: Animated.AnimatedInterpolation<number>;
  categoriesRowTranslate: Animated.AnimatedInterpolation<number>;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
  topRatedOnly: boolean;
  onToggleTopRated: () => void;
  topInset: number;
}) {
  return (
    <View>
      {/* Flat header — no gradient, no rounded crop, sits inside the safe area.
          paddingTop aqui é O ÚNICO lugar que aplica o inset de topo agora
          (insets.top + o respiro visual de 8px que já existia). Controlado
          na mão, sem depender do SafeAreaView calcular sozinho. */}
      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.logo}>Vitória Delivery</Text>
          {userName ? <Text style={styles.greeting}>Olá, {userName} 👋</Text> : null}
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, !notificationsEnabled && styles.iconBtnMuted]}
          activeOpacity={0.7}
          onPress={onToggleNotifications}
          accessibilityRole="button"
          accessibilityLabel={notificationsEnabled ? 'Desativar notificações' : 'Ativar notificações'}
        >
          <Ionicons
            name={notificationsEnabled ? 'notifications' : 'notifications-off-outline'}
            size={20}
            color={notificationsEnabled ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchBar editable={false} onPress={onNavigateSearch} placeholder="Buscar restaurantes ou comidas" />
        </View>
        <TouchableOpacity
          style={[styles.starBtn, topRatedOnly && styles.starBtnActive]}
          activeOpacity={0.7}
          onPress={onToggleTopRated}
          accessibilityRole="button"
          accessibilityLabel={topRatedOnly ? 'Ver todos os restaurantes' : 'Ver restaurantes mais bem avaliados'}
        >
          <Ionicons
            name={topRatedOnly ? 'star' : 'star-outline'}
            size={21}
            color={topRatedOnly ? colors.star : colors.primary}
          />
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
          gatilho pra mostrar a barra fixa e compacta lá embaixo. O grupo
          inteiro recebe um fade + leve subida conforme o scroll se aproxima
          do ponto de troca, pra dar a sensação de que ele "encolhe" pra
          virar a barra fixa em vez de simplesmente sumir de tela.
          O padding fica no CONTEÚDO do ScrollView (não no wrapper de fora):
          assim a área de toque/arraste ocupa a tela inteira, de ponta a
          ponta, em vez de deixar uma faixa "morta" de 20px nas bordas onde
          o gesto de arrastar não pegava (a "barreira invisível"). */}
      <Animated.View
        style={[
          styles.categoriesRow,
          { opacity: categoriesRowOpacity, transform: [{ translateY: categoriesRowTranslate }] },
        ]}
        onLayout={(e) => onMeasureCategories(e.nativeEvent.layout.y)}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={styles.categoriesScrollContent}
        >
          <CategoryChip
            name="Tudo"
            emoji={getCategoryEmoji(null)}
            active={activeCategory === null}
            onPress={() => onSelectCategory(null)}
          />
          {categories.map((c) => (
            <CategoryChip
              key={c.id}
              name={c.name}
              emoji={getCategoryEmoji(c.name)}
              active={activeCategory === c.id}
              onPress={() => onSelectCategory(c.id)}
            />
          ))}
        </ScrollView>
      </Animated.View>

      <View style={{ marginTop: 18 }}>
        <PromoCarousel />
      </View>

      <View style={styles.contentPad}>
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
  const { enabled: notificationsEnabled, toggle: toggleNotifications } = useNotifications();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  // Estrelinha ao lado da busca: quando ativa, mostra só os restaurantes
  // mais bem avaliados (nota mais alta primeiro).
  const [topRatedOnly, setTopRatedOnly] = useState(false);
  const toggleTopRated = useCallback(() => setTopRatedOnly((prev) => !prev), []);

  // Posição (Y) de onde começa a fileira de categorias dentro do header —
  // é o ponto que usamos pra saber quando trocar pra barra fixa e compacta.
  const [categoriesY, setCategoriesY] = useState<number | null>(null);
  const [showStickyCategories, setShowStickyCategories] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const [locationText, setLocationText] = useState('Toque para definir localização');
  const [locationLoading, setLocationLoading] = useState(false);

  // ------------------------------------------------------------------
  // Splash de entrada — cobre a tela por um tempinho mínimo (pra não
  // "piscar" em conexões rápidas) e só some quando ele já passou E os
  // dados iniciais (restaurantes) já carregaram. Assim o usuário nunca
  // vê a lista aparecendo pela metade ou o layout pulando.
  // ------------------------------------------------------------------
  const [showSplash, setShowSplash] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [initialDataReady, setInitialDataReady] = useState(false);
  const initialLoadRef = useRef(false);
  const splashOpacity = useRef(new Animated.Value(1)).current;
  const splashLogoScale = useRef(new Animated.Value(0.85)).current;
  const splashPulse = useRef(new Animated.Value(1)).current;

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

  // Com a estrelinha ativa, mostra só quem tem nota alta (4.5+), do maior
  // pro menor -- os restaurantes mais bem avaliados primeiro.
  const displayedRestaurants = useMemo(() => {
    if (!topRatedOnly) return restaurants;
    return [...restaurants]
      .filter((r) => r.rating >= 4.5)
      .sort((a, b) => b.rating - a.rating);
  }, [restaurants, topRatedOnly]);

  // Assim que o primeiro carregamento de restaurantes termina (loading passa
  // de true pra false pela primeira vez), marcamos os dados como prontos.
  // Trocas de categoria depois disso não mexem mais nisso.
  useEffect(() => {
    if (!loading && !initialLoadRef.current) {
      initialLoadRef.current = true;
      setInitialDataReady(true);
    }
  }, [loading]);

  // Animação de entrada do splash: ícone "pulsando" enquanto tudo carrega,
  // e um tempo mínimo de exibição pra não parecer um piscar rápido demais.
  useEffect(() => {
    Animated.spring(splashLogoScale, {
      toValue: 1,
      friction: 6,
      tension: 50,
      useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(splashPulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(splashPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.start();

    const timer = setTimeout(() => setMinTimeElapsed(true), 1200);
    return () => {
      clearTimeout(timer);
      pulseLoop.stop();
    };
  }, []);

  // Quando o tempo mínimo já passou E os dados já chegaram, faz o fade-out
  // do splash e só então desmonta (pra não bloquear toques desnecessariamente).
  useEffect(() => {
    if (minTimeElapsed && initialDataReady && showSplash) {
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 380,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }
  }, [minTimeElapsed, initialDataReady, showSplash]);

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
  // A barra fixa entra com fade + leve deslizar + escala, numa faixa um
  // pouco mais larga (40px) pra ficar suave em vez de um corte seco.
  const stickyOpacity = scrollY.interpolate({
    inputRange: [Math.max(stickyThreshold - 40, 0), stickyThreshold],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const stickyTranslate = scrollY.interpolate({
    inputRange: [Math.max(stickyThreshold - 40, 0), stickyThreshold],
    outputRange: [-16, 0],
    extrapolate: 'clamp',
  });
  const stickyScale = scrollY.interpolate({
    inputRange: [Math.max(stickyThreshold - 40, 0), stickyThreshold],
    outputRange: [0.94, 1],
    extrapolate: 'clamp',
  });

  // As categorias circulares (versão normal) fazem o caminho inverso: vão
  // sumindo e subindo levemente conforme o scroll se aproxima do ponto de
  // troca, como se estivessem "encolhendo" pra dar lugar à barra fixa.
  const categoriesRowOpacity = scrollY.interpolate({
    inputRange: [Math.max(stickyThreshold - 40, 0), stickyThreshold],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const categoriesRowTranslate = scrollY.interpolate({
    inputRange: [Math.max(stickyThreshold - 40, 0), stickyThreshold],
    outputRange: [0, -10],
    extrapolate: 'clamp',
  });

  return (
    // edges={[]} DE PROPÓSITO: não deixamos o SafeAreaView calcular/aplicar
    // o inset de topo sozinho. Em vez disso, controlamos esse espaço na mão
    // (ver `paddingTop: insets.top` logo abaixo, no topBar). Isso existe
    // porque, se houver QUALQUER outro SafeAreaView/wrapper por fora desta
    // tela (App.tsx, Tab/Stack Navigator) também aplicando edges={['top']},
    // os dois insets se somavam e empurravam o conteúdo pra baixo -- essa
    // é a causa mais comum de uma "faixa em branco" estrutural no topo que
    // não é resolvida mexendo em cor ou em StatusBar.
    <SafeAreaView style={styles.safe} edges={[]}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <AnimatedFlatList
        data={displayedRestaurants}
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
            categoriesRowOpacity={categoriesRowOpacity}
            categoriesRowTranslate={categoriesRowTranslate}
            notificationsEnabled={notificationsEnabled}
            onToggleNotifications={toggleNotifications}
            topRatedOnly={topRatedOnly}
            onToggleTopRated={toggleTopRated}
            topInset={insets.top}
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
              <Ionicons
                name={topRatedOnly ? 'star-outline' : 'restaurant-outline'}
                size={40}
                color={colors.textMuted}
              />
              <Text style={styles.emptyText}>
                {topRatedOnly
                  ? 'Nenhum restaurante muito bem avaliado por aqui ainda.'
                  : 'Nenhum restaurante nessa categoria ainda.'}
              </Text>
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
            transform: [{ translateY: stickyTranslate }, { scale: stickyScale }],
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
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

      {/* Splash de entrada — some sozinho quando os dados chegam e o tempo
          mínimo já passou. pointerEvents "none" evita bloquear a tela toda
          vez que ele já estiver invisível mas ainda montado durante o fade. */}
      {showSplash && (
        <Animated.View
          style={[styles.splashOverlay, { opacity: splashOpacity }]}
          pointerEvents={showSplash ? 'auto' : 'none'}
        >
          <Animated.View
            style={{
              transform: [{ scale: Animated.multiply(splashLogoScale, splashPulse) }],
            }}
          >
            <View style={styles.splashLogoCircle}>
              <Ionicons name="restaurant" size={38} color={colors.white} />
            </View>
          </Animated.View>
          <Text style={styles.splashTitle}>Vitória Delivery</Text>
          <Text style={styles.splashSubtitle}>Preparando tudo pra você...</Text>
        </Animated.View>
      )}
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
    // paddingTop é aplicado via inline style em ListHeader (insets.top + 8),
    // não aqui -- ver comentário no componente ListHeader.
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
  iconBtnMuted: {
    backgroundColor: colors.border,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: H_PAD,
    marginTop: 14,
  },
  starBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starBtnActive: {
    borderColor: colors.star,
    backgroundColor: 'rgba(255,180,0,0.12)',
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

  categoriesRow: { marginTop: 14 },
  categoriesScrollContent: { paddingHorizontal: H_PAD },

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
  categoryEmoji: { fontSize: 26 },

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
    marginRight: BANNER_GAP,
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
    borderRadius: 22,
    marginBottom: 14,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardImage: { width: '100%', height: 104, borderRadius: 16, backgroundColor: colors.border },
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
  cardBody: { paddingTop: 10, paddingHorizontal: 2 },
  cardTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text, marginBottom: 5 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  cardRating: { fontSize: 11.5, color: colors.text, fontWeight: '700' },
  cardMeta: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600' },
  cardFee: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600', marginTop: 3 },

  emptyState: { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText: { color: colors.textMuted, textAlign: 'center' },

  // --- splash de entrada ---
  splashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  splashLogoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  splashTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    marginTop: 18,
  },
  splashSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 6,
  },
});