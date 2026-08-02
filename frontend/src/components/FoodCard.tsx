import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MenuItem } from '../types';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

interface Props {
  item: MenuItem;
  onAdd: () => void;
}

export function FoodCard({ item, onAdd }: Props) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.image} />
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.bottomRow}>
          <Text style={styles.price}>R$ {item.price.toFixed(2)}</Text>
          <TouchableOpacity onPress={onAdd} style={styles.addBtn} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: 84, height: 84, borderRadius: 12, backgroundColor: colors.border },
  info: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  name: { ...typography.bodyBold, color: colors.text },
  desc: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  price: { ...typography.bodyBold, color: colors.text },
  addBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
});
