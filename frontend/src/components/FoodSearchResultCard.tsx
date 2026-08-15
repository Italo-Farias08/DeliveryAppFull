// components/FoodSearchResultCard.tsx
//
// Card de um resultado da busca por PRATO (não por restaurante). Mostra a
// foto do prato, nome, preço, e -- pra deixar claro de onde vem o pedido
// -- a logo + nome do restaurante de origem, num rodapé dentro do card.
// Tocar no card leva pro restaurante, onde o cliente monta o pedido.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { FoodSearchResult } from '../types';

interface Props {
  item: FoodSearchResult;
  onPress: () => void;
}

export function FoodSearchResultCard({ item, onPress }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const soldOut = item.isAvailable === false;
  const closed = item.restaurantIsOpen === false;

  return (
    <TouchableOpacity
      style={[styles.card, (soldOut || closed) && styles.cardMuted]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.topRow}>
        <View>
          <Image
            source={{ uri: item.image }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
          {soldOut && (
            <View style={styles.badgeOverlay}>
              <Text style={styles.badgeText}>Esgotado</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          <Text style={styles.price}>R$ {item.price.toFixed(2)}</Text>
        </View>
      </View>

      {/* rodapé com a origem do prato -- é aqui que fica claro de qual
          restaurante o item vem */}
      <View style={styles.restaurantRow}>
        {!!item.restaurantImage && (
          <Image
            source={{ uri: item.restaurantImage }}
            style={styles.restaurantLogo}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        )}
        <Text style={styles.restaurantName} numberOfLines={1}>{item.restaurantName}</Text>
        {closed && <Text style={styles.closedText}>· Fechado agora</Text>}
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
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
  cardMuted: { opacity: 0.65 },
  topRow: { flexDirection: 'row' },
  image: { width: 88, height: 88, borderRadius: 14, backgroundColor: colors.border },
  badgeOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(28,27,26,0.75)',
    borderRadius: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  content: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  name: { ...typography.bodyBold, color: colors.text, fontSize: 15.5, marginBottom: 3 },
  description: { fontSize: 12.5, color: colors.textMuted, lineHeight: 17, marginBottom: 6 },
  price: { fontSize: 15, fontWeight: '800', color: colors.primary },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  restaurantLogo: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.border },
  restaurantName: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted, flexShrink: 1 },
  closedText: { fontSize: 12, color: colors.danger, fontWeight: '600' },
});
};
