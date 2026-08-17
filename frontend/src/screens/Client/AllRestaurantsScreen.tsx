import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RestaurantGridCard } from '../../components/RestaurantGridCard';
import { SearchBar } from '../../components/SearchBar';
import { useTheme } from '../../context/ThemeContext';
import { getCategories, getRestaurants } from '../../services/restaurantService';
import { useUserCoords } from '../../hooks/useUserCoords';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Category, Restaurant } from '../../types';

// Mesmos emojis usados na Home, pra manter os chips de categoria consistentes
// entre as duas telas.
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

type AllRestaurantsRouteProp = RouteProp<{ AllRestaurants: { categoryId?: string | null } }, 'AllRestaurants'>;

export default function AllRestaurantsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();
  const route = useRoute<AllRestaurantsRouteProp>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(route.params?.categoryId ?? null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [topRatedOnly, setTopRatedOnly] = useState(false);
  const coords = useUserCoords();

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    setLoading(true);
    getRestaurants(activeCategory ?? undefined, coords)
      .then(setRestaurants)
      .finally(() => setLoading(false));
  }, [activeCategory, coords]);

  const toggleTopRated = useCallback(() => setTopRatedOnly((prev) => !prev), []);

  // Igual à Home: com o filtro ativo, mostra só quem tem nota alta,
  // do maior pro menor.
  const displayedRestaurants = useMemo(() => {
    if (!topRatedOnly) return restaurants;
    return [...restaurants].filter((r) => r.rating >= 4.0).sort((a, b) => b.rating - a.rating);
  }, [restaurants, topRatedOnly]);

  const goToSearch = useCallback(() => navigation.navigate('Search'), [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Todos os restaurantes</Text>
        <TouchableOpacity
          style={[styles.starBtn, topRatedOnly && styles.starBtnActive]}
          activeOpacity={0.7}
          onPress={toggleTopRated}
          accessibilityRole="button"
          accessibilityLabel={topRatedOnly ? 'Ver todos os restaurantes' : 'Ver restaurantes mais bem avaliados'}
        >
          <Ionicons name={topRatedOnly ? 'star' : 'star-outline'} size={19} color={topRatedOnly ? colors.star : colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <SearchBar editable={false} onPress={goToSearch} placeholder="Buscar restaurantes ou comidas" />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScrollContent}
        style={styles.categoriesRow}
      >
        <CategoryChip
          name="Tudo"
          emoji={getCategoryEmoji(null)}
          active={activeCategory === null}
          onPress={() => setActiveCategory(null)}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c.id}
            name={c.name}
            emoji={getCategoryEmoji(c.name)}
            active={activeCategory === c.id}
            onPress={() => setActiveCategory(c.id)}
          />
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={displayedRestaurants}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.gridItem}>
              <RestaurantGridCard
                restaurant={item}
                onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="restaurant-outline" size={30} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>Nenhum restaurante encontrado por aqui.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

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
  const { colors } = useTheme();
  const styles = createStyles(colors);
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    title: { ...typography.h2, color: colors.text, flex: 1 },
    starBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    starBtnActive: {
      borderColor: colors.star,
      backgroundColor: 'rgba(255,180,0,0.12)',
    },

    searchRow: { paddingHorizontal: 20, marginTop: 10 },

    categoriesRow: { marginTop: 16, flexGrow: 0 },
    categoriesScrollContent: { paddingHorizontal: 20 },
    categoryChip: { alignItems: 'center', width: 68, marginRight: 8 },
    categoryCircle: {
      width: 58,
      height: 58,
      borderRadius: 29,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    categoryCircleActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.28,
      shadowRadius: 8,
      elevation: 3,
    },
    categoryLabel: { fontSize: 11.5, color: colors.textMuted, marginTop: 7, fontWeight: '600' },
    categoryLabelActive: { color: colors.primary, fontWeight: '700' },
    categoryEmoji: { fontSize: 24 },

    listContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24 },
    columnWrapper: { justifyContent: 'space-between' },
    gridItem: { width: '48%', marginBottom: 4 },

    emptyState: { alignItems: 'center', marginTop: 60, gap: 10, paddingHorizontal: 30 },
    emptyIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { color: colors.textMuted, textAlign: 'center' },
  });
}
