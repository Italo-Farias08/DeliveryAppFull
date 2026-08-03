import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listMyOrders } from '../../services/orderService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Order, OrderStatus } from '../../types';

const statusMap: Record<OrderStatus, { label: string; color: string }> = {
  preparando: { label: 'Preparando', color: colors.star },
  'a caminho': { label: 'A caminho', color: colors.secondary },
  entregue: { label: 'Entregue', color: colors.textMuted },
  cancelado: { label: 'Cancelado', color: colors.danger },
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await listMyOrders();
      setOrders(data);
    } catch {
      // silencioso: mantém a última lista carregada
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Meus pedidos</Text>
      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 20, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={54} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
              <Text style={styles.emptySub}>Seus pedidos vão aparecer aqui depois da primeira compra</Text>
            </View>
          }
          renderItem={({ item }: { item: Order }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>{item.restaurantName} · #{item.id.slice(-5)}</Text>
                <View style={[styles.badge, { backgroundColor: statusMap[item.status].color }]}>
                  <Text style={styles.badgeText}>{statusMap[item.status].label}</Text>
                </View>
              </View>
              <Text style={styles.itemsText}>
                {item.items.map((it) => `${it.qty}x ${it.name}`).join(', ')}
              </Text>
              <View style={styles.footerRow}>
                <Text style={styles.feeText}>Entrega: R$ {item.deliveryFee.toFixed(2)}</Text>
                <Text style={styles.total}>R$ {item.total.toFixed(2)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text, paddingHorizontal: 20, marginBottom: 6 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { ...typography.h2, color: colors.text, marginTop: 8 },
  emptySub: { color: colors.textMuted, textAlign: 'center', maxWidth: 260 },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  orderId: { ...typography.bodyBold, color: colors.text, flex: 1, marginRight: 8 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  itemsText: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeText: { color: colors.textMuted, fontSize: 12 },
  total: { ...typography.bodyBold, color: colors.primary },
});
