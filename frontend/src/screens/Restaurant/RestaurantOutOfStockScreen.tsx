import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import RestaurantScreenLayout from '../../components/RestaurantScreenLayout';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import { setMenuItemAvailability } from '../../services/tenantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { MenuItem } from '../../types';

// Área de esgotados: mostra o cardápio inteiro do restaurante e deixa
// marcar/desmarcar cada item como esgotado (is_available = false), sem
// precisar entrar em "editar item" pra isso. Item esgotado continua
// aparecendo pro cliente, mas com selo "Esgotado", descrição apagada e
// sem botão de adicionar (ver FoodCard.tsx) -- assim ele sabe que existe
// no cardápio, só não pode pedir agora.
export default function RestaurantOutOfStockScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { menuItems, setMenuItems, menuCategories, refreshing, reload } = useRestaurantPanel();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const outOfStockCount = menuItems.filter((i) => !i.isAvailable).length;

  // Agrupa por categoria do cardápio, igual à tela de edição, pra ficar
  // fácil de achar o item -- categoria "Outros" pra quem não tem uma.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, MenuItem[]>();
    for (const item of menuItems) {
      const key = item.categoryId || 'none';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(item);
    }
    const sections = menuCategories
      .map((cat) => ({ id: cat.id, name: cat.name, items: byCategory.get(cat.id) || [] }))
      .filter((s) => s.items.length > 0);
    const noCategory = byCategory.get('none') || [];
    if (noCategory.length > 0) sections.push({ id: 'none', name: 'Outros', items: noCategory });
    return sections;
  }, [menuItems, menuCategories]);

  async function handleToggle(item: MenuItem, value: boolean) {
    setTogglingId(item.id);
    const previous = menuItems;
    // Otimista: marca na hora e só desfaz se a chamada falhar.
    setMenuItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, isAvailable: value } : i)));
    try {
      await setMenuItemAvailability(item.id, value);
    } catch {
      setMenuItems(previous);
      Alert.alert('Erro', 'Não foi possível atualizar esse item agora. Tente de novo.');
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <RestaurantScreenLayout title="Esgotados" subtitle="Marque o que acabou no seu cardápio" active="OutOfStock">
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} />}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconCircle}>
            <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>
              {outOfStockCount === 0 ? 'Nada esgotado agora' : `${outOfStockCount} ${outOfStockCount === 1 ? 'item esgotado' : 'itens esgotados'}`}
            </Text>
            <Text style={styles.summarySub}>Itens esgotados somem do cardápio que o cliente vê</Text>
          </View>
        </View>

        {menuItems.length === 0 && (
          <Text style={styles.emptyText}>Você ainda não tem itens no cardápio.</Text>
        )}

        {grouped.map((section) => (
          <View key={section.id} style={{ marginBottom: 22 }}>
            <Text style={styles.sectionTitle}>{section.name}</Text>
            {section.items.map((item) => (
              <View key={item.id} style={styles.row}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
                ) : (
                  <View style={[styles.thumb, styles.thumbPlaceholder]}>
                    <Ionicons name="fast-food-outline" size={18} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemName, !item.isAvailable && styles.itemNameOut]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemPrice}>R$ {item.price.toFixed(2)}</Text>
                </View>
                {togglingId === item.id ? (
                  <ActivityIndicator color={colors.primary} style={{ width: 51 }} />
                ) : (
                  <Switch
                    value={!item.isAvailable}
                    onValueChange={(value) => handleToggle(item, !value)}
                    trackColor={{ true: colors.danger, false: colors.border }}
                    thumbColor={colors.white}
                  />
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </RestaurantScreenLayout>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  summaryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 18, padding: 16,
    marginBottom: 24, ...shadows.sm,
  },
  summaryIconCircle: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryTitle: { ...typography.bodyBold, color: colors.text, fontSize: 14.5 },
  summarySub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  emptyText: { color: colors.textMuted, fontSize: 13.5, textAlign: 'center', marginTop: 30 },
  sectionTitle: {
    ...typography.bodyBold, color: colors.text, fontSize: 13.5,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 10,
    marginBottom: 8, ...shadows.sm,
  },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  thumbPlaceholder: { backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  itemName: { ...typography.bodyBold, color: colors.text, fontSize: 14 },
  itemNameOut: { color: colors.textMuted, textDecorationLine: 'line-through' },
  itemPrice: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
});
};