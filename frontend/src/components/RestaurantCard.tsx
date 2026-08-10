import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Restaurant } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { formatRating } from '../utils/rating';

interface Props {
  restaurant: Restaurant;
  onPress: () => void;
}

export function RestaurantCard({ restaurant, onPress }: Props) {
  const ratingDisplay = formatRating(restaurant.rating, restaurant.ratingCount);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', marginBottom: 18 },
  image: { width: '100%', height: 150, borderRadius: 16, backgroundColor: colors.border },
  closedBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: colors.overlay, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8,
  },
  closedText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  info: { paddingTop: 8, paddingHorizontal: 2 },
  name: { ...typography.h2, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  meta: { fontSize: 12.5, color: colors.textMuted, fontWeight: '600' },
  dot: { color: colors.textMuted },
  fee: { fontSize: 12.5, color: colors.secondary, fontWeight: '600', marginTop: 2 },
});