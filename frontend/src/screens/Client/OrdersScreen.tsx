import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listMyOrders } from '../../services/orderService';
import { connectSocket, disconnectSocket } from '../../services/socket';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Order, OrderStatus } from '../../types';

const statusMap: Record<OrderStatus, { label: string; color: string }> = {
  pendente: { label: 'Aguardando restaurante', color: colors.primary },
  preparando: { label: 'Preparando', color: colors.star },
  procurando_entregador: { label: 'Buscando entregador', color: colors.secondary },
  a_caminho: { label: 'A caminho', color: colors.secondary },
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

  // Atualiza o status do pedido em tempo real (aceito, pronto, a caminho, entregue...)
  useEffect(() => {
    connectSocket().then((s) => {
      if (!s) return;
      s.on('order:status', ({ id, status }: { id: string; status: OrderStatus }) => {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
      });
    });
    return () => {
      disconnectSocket();
    };
  }, []);

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
                {(item.items ?? []).map((it) => `${it.qty}x ${it.name}`).join(', ')}
              </Text>

              {item.status === 'a_caminho' && item.deliveryCode && (
                <View style={styles.codeBanner}>
                  <Ionicons name="key-outline" size={18} color={colors.secondary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeBannerLabel}>Código de entrega</Text>
                    <Text style={styles.codeBannerSub}>
                      Informe esse código ao entregador quando ele chegar
                    </Text>
                  </View>
                  <Text style={styles.deliveryCode}>{item.deliveryCode}</Text>
                </View>
              )}

              {item.status === 'cancelado' && item.cancelReason && (
                <Text style={styles.cancelReason}>Motivo: {item.cancelReason}</Text>
              )}

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
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  feeText: { color: colors.textMuted, fontSize: 12 },
  total: { ...typography.bodyBold, color: colors.primary },
  codeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 8,
    backgroundColor: colors.secondaryLight, borderRadius: 12, padding: 12,
  },
  codeBannerLabel: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  codeBannerSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  deliveryCode: { ...typography.h2, color: colors.secondary, letterSpacing: 3 },
  cancelReason: { color: colors.danger, fontSize: 12.5, marginBottom: 8 },
});
