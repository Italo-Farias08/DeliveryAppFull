import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFavorites } from '../../context/FavoritesContext';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { Restaurant } from '../../types';

export default function FavoritesScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();
  const { favorites, loading, refresh, toggleFavorite } = useFavorites();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Favoritos</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading && favorites.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Nenhum favorito ainda</Text>
          <Text style={styles.emptySubtitle}>
            Toque no coração de um restaurante para salvá-lo aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <FavoriteRow
              restaurant={item}
              onPress={() => navigation.navigate('Home', { screen: 'RestaurantDetail', params: { restaurantId: item.id } })}
              onRemove={() => toggleFavorite(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function FavoriteRow({
  restaurant,
  onPress,
  onRemove,
}: {
  restaurant: Restaurant;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={onPress}>
      <Image source={{ uri: restaurant.image || undefined }} style={styles.rowImage} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{restaurant.name}</Text>
        <View style={styles.rowMeta}>
          <Ionicons name="star" size={12} color={colors.star} />
          <Text style={styles.rowMetaText}>{restaurant.rating?.toFixed(1) ?? '—'}</Text>
          <Text style={styles.rowMetaDot}>·</Text>
          <Text style={styles.rowMetaText}>{restaurant.deliveryTimeMin}-{restaurant.deliveryTimeMax} min</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onRemove} hitSlop={10} style={styles.removeBtn}>
        <Ionicons name="heart" size={20} color={colors.primary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 10,
  },
  title: { ...typography.h1, color: colors.text, fontSize: 19 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 8 },
  emptyTitle: { ...typography.h2, color: colors.text, marginTop: 8 },
  emptySubtitle: { color: colors.textMuted, fontSize: 13.5, textAlign: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 16, padding: 12,
    ...shadows.sm,
  },
  rowImage: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.border },
  rowTitle: { ...typography.h2, fontSize: 15, color: colors.text },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rowMetaText: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  rowMetaDot: { color: colors.textMuted, fontSize: 12.5 },
  removeBtn: { padding: 4 },
});
};
