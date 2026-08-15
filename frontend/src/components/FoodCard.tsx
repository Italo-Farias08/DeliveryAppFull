// components/FoodCard.tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { MenuItem } from '../types';

interface FoodCardProps {
  item: MenuItem;
  onAdd: () => void;
}

export function FoodCard({ item, onAdd }: FoodCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const soldOut = item.isAvailable === false;

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
        <Text style={[styles.price, soldOut && styles.textMuted]}>R$ {item.price.toFixed(2)}</Text>
      </View>

      {!soldOut && (
        <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
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
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
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
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
});
};