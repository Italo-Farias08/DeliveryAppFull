import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useFavorites } from '../context/FavoritesContext';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { Restaurant } from '../types';
import { formatRating } from '../utils/rating';
import { getFallbackRestaurantImage } from '../utils/restaurantImage';

// Card compacto, pensado para grid de 2 colunas. Usa a LOGO do restaurante
// (restaurant.image), igual à tela de detalhes. Se um dia você quiser
// mostrar o banner/foto de capa em vez da logo aqui, troque
// `restaurant.image` por `restaurant.banner || restaurant.image`.
export function RestaurantGridCard({ restaurant, onPress }: { restaurant: Restaurant; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorite = isFavorite(restaurant.id);
  const [imgError, setImgError] = useState(false);

  // campo certo é `image` (a logo do restaurante) -- `imageUrl` não existe
  // no tipo Restaurant, então antes isso sempre caía no fallback aleatório.
  const hasImage = !!restaurant.image && !imgError;
  const imageSource = hasImage ? { uri: restaurant.image } : getFallbackRestaurantImage(restaurant.id);
  const isFree = (restaurant.deliveryFee ?? 0) === 0;
  const closed = restaurant.isOpen === false;
  const ratingDisplay = formatRating(restaurant.rating, restaurant.ratingCount);

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.cardImageWrap}>
        <Image
          source={imageSource}
          style={[styles.cardImage, closed && styles.cardImageClosed]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setImgError(true)}
        />

        {/* nota em badge sobre a foto -- "Novo" pra restaurante que ainda
            não recebeu nenhuma avaliação real, em vez de "0.0" */}
        <View style={styles.ratingBadge}>
          {ratingDisplay ? (
            <>
              <Ionicons name="star" size={10} color={colors.star} />
              <Text style={styles.ratingBadgeText}>{ratingDisplay}</Text>
            </>
          ) : (
            <Text style={styles.ratingBadgeText}>Novo</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={() => toggleFavorite(restaurant)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={14} color={colors.primary} />
        </TouchableOpacity>

        {closed && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedBadgeText}>Fechado</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{restaurant.name}</Text>
        <View style={styles.cardMetaRow}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.cardMeta} numberOfLines={1}>
            {restaurant.deliveryTimeMin}–{restaurant.deliveryTimeMax} min
          </Text>
          <View style={styles.metaDot} />
          <Text style={[styles.cardMeta, isFree && styles.cardFeeFree]} numberOfLines={1}>
            {isFree ? 'Grátis' : `R$ ${restaurant.deliveryFee?.toFixed(2) ?? '0,00'}`}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginBottom: 16,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    cardImageWrap: { position: 'relative' },
    cardImage: { width: '100%', height: 110, backgroundColor: colors.border },
    cardImageClosed: { opacity: 0.45 },
    ratingBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: 'rgba(28,27,26,0.72)',
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 4,
    },
    ratingBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
    favoriteBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(255,255,255,0.92)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closedBadge: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(28,27,26,0.75)',
      paddingVertical: 5,
      alignItems: 'center',
    },
    closedBadgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
    cardBody: { paddingTop: 10, paddingHorizontal: 10, paddingBottom: 12 },
    cardTitle: { fontSize: 13.5, fontWeight: '700', color: colors.text, marginBottom: 5 },
    cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardMeta: { fontSize: 11.5, color: colors.textMuted, fontWeight: '600' },
    cardFeeFree: { color: colors.secondary, fontWeight: '700' },
    metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.border },
  });
}
