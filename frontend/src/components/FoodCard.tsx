// components/FoodCard.tsx
import React, { useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { shadows, coloredShadow } from '../theme/shadows';
import { MenuItem } from '../types';
import { PressableScale } from './PressableScale';

interface FoodCardProps {
  item: MenuItem;
  onAdd: () => void;
}

export function FoodCard({ item, onAdd }: FoodCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const soldOut = item.isAvailable === false;

  // Pequeno "pop" no ícone quando o item é adicionado -- reforço visual
  // divertido além do encolher normal do toque.
  const pop = useRef(new Animated.Value(1)).current;
  function handleAdd() {
    onAdd();
    pop.setValue(1);
    Animated.sequence([
      Animated.spring(pop, { toValue: 1.35, friction: 4, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }

  return (
    <View style={[styles.card, soldOut && styles.cardSoldOut]}>
      <View>
        <Image
          source={{ uri: item.image }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
        {soldOut && (
          <View style={styles.soldOutOverlay}>
            <Text style={styles.soldOutBadgeText}>Esgotado</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={[styles.name, soldOut && styles.textMuted]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.description, soldOut && styles.textMuted]} numberOfLines={3}>
          {item.description}
        </Text>
        {item.promoPrice ? (
          <View style={styles.priceRow}>
            <Text style={styles.priceOld}>R$ {item.price.toFixed(2)}</Text>
            <Text style={[styles.price, soldOut && styles.textMuted]}>R$ {item.promoPrice.toFixed(2)}</Text>
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>PROMOÇÃO</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.price, soldOut && styles.textMuted]}>R$ {item.price.toFixed(2)}</Text>
        )}
      </View>

      {!soldOut && (
        <PressableScale onPress={handleAdd} style={styles.addBtn} scaleTo={0.85}>
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Ionicons name="add" size={22} color={colors.white} />
          </Animated.View>
        </PressableScale>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
    ...shadows.sm,
  },
  cardSoldOut: { opacity: 0.65 },
  image: {
    width: 96,
    height: 96,
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  soldOutOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(28,27,26,0.75)',
    borderRadius: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  soldOutBadgeText: { color: colors.white, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.3 },
  content: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  name: {
    ...typography.bodyBold,
    color: colors.text,
    fontSize: 16,
    marginBottom: 4,
  },
  description: {
    fontSize: 12.5,
    color: colors.textMuted,
    lineHeight: 17,
    marginBottom: 8,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.primary,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  priceOld: { fontSize: 12.5, color: colors.textMuted, textDecorationLine: 'line-through' },
  promoBadge: { backgroundColor: colors.star, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  promoBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#402D00', letterSpacing: 0.3 },
  textMuted: { color: colors.textMuted },
  addBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...coloredShadow(colors.primary, 0.35),
  },
});
};