import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Restaurant } from '../types';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows } from '../theme/shadows';
import { formatRating } from '../utils/rating';
import { PressableScale } from './PressableScale';

interface Props {
  restaurant: Restaurant;
  onPress: () => void;
}

export function RestaurantCard({ restaurant, onPress }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const ratingDisplay = formatRating(restaurant.rating, restaurant.ratingCount);

  return (
    <PressableScale onPress={onPress} style={styles.card} scaleTo={0.98}>
      <View>
        <Image
          source={{ uri: restaurant.banner || restaurant.image }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
        {!restaurant.isOpen && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedText}>Fechado</Text>
          </View>
        )}
        {restaurant.hasPromo && (
          <View style={styles.promoBadge}>
            <Ionicons name="pricetag" size={11} color="#402D00" />
            <Text style={styles.promoBadgeText}>Promoção</Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{restaurant.name}</Text>
        <View style={styles.row}>
          {ratingDisplay ? (
            <>
              <Ionicons name="star" size={13} color={colors.star} />
              <Text style={styles.meta}>{ratingDisplay}</Text>
            </>
          ) : (
            <Text style={styles.meta}>Novo por aqui</Text>
          )}
          <Text style={styles.dot}>·</Text>
          <Text style={styles.meta}>{restaurant.deliveryTimeMin}-{restaurant.deliveryTimeMax} min</Text>
        </View>
        <Text style={styles.fee}>
          {restaurant.deliveryFee === 0 ? 'Entrega grátis' : `Entrega R$ ${restaurant.deliveryFee.toFixed(2)}`}
        </Text>
      </View>
    </PressableScale>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: { width: '100%', marginBottom: 18 },
  image: { width: '100%', height: 150, borderRadius: 16, backgroundColor: colors.border, ...shadows.sm },
  closedBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: colors.overlay, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8,
  },
  closedText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  promoBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.star, paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8,
  },
  promoBadgeText: { color: '#402D00', fontSize: 11, fontWeight: '800' },
  info: { paddingTop: 8, paddingHorizontal: 2 },
  name: { ...typography.h2, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  meta: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  dot: { color: colors.textMuted },
  fee: { fontSize: 12.5, color: colors.secondary, fontWeight: '600', marginTop: 2 },
});
};