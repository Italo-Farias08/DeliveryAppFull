import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import OrderChatModal from '../../components/OrderChatModal';
import { useCart } from '../../context/CartContext';
import { getOrderMessages, listMyOrders, sendOrderMessage } from '../../services/orderService';
import { connectSocket, disconnectSocket } from '../../services/socket';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Order, OrderStatus } from '../../types';

// Status com cor + ícone próprios — usados tanto no badge (fundo suave,
// texto colorido) quanto pra decidir se ainda vale mostrar o código de
// entrega, etc.
const statusMap: Record<OrderStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pendente: { label: 'Aguardando restaurante', color: colors.primary, icon: 'hourglass-outline' },
  preparando: { label: 'Preparando', color: '#B8860B', icon: 'restaurant-outline' },
  procurando_entregador: { label: 'Buscando entregador', color: colors.secondary, icon: 'search-outline' },
  a_caminho: { label: 'A caminho', color: colors.secondary, icon: 'bicycle-outline' },
  entregue: { label: 'Entregue', color: '#4A9B6E', icon: 'checkmark-circle-outline' },
  cancelado: { label: 'Cancelado', color: colors.danger, icon: 'close-circle-outline' },
};

// Fundo suave pro badge de status: pega a cor do status e aplica bem clara,
// em vez do badge sólido "gritando" a cor — fica mais elegante e ainda
// assim continua fácil de escanear visualmente.
function softBg(hex: string) {
  return hex + '1F'; // ~12% de opacidade sobre a cor sólida
}

// "Hoje, 14:32" / "Ontem, 19:04" / "12 ago, 09:15" — sem depender de
// nenhuma lib de datas externa.
function formatOrderDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (isSameDay(date, now)) return `Hoje, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Ontem, ${time}`;

  const day = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return `${day} · ${time}`;
}

export default function OrdersScreen() {
  const navigation = useNavigation<any>();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);

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

  // "Pedir novamente": reconstrói o carrinho com os mesmos itens do pedido
  // entregue e manda o usuário direto pro Carrinho, já pronto pra revisar
  // e finalizar. addItem é chamado uma vez por unidade (qty) de cada item,
  // igual ao fluxo normal de adicionar pelo FoodCard.
  // OBS: assume que `Order.items[].qty/name/price/id` tem o mesmo formato
  // aceito por `addItem` no CartContext (o mesmo objeto usado ao montar o
  // pedido originalmente). Se o carrinho travar restaurantes diferentes,
  // o próprio addItem/CartContext deve tratar a troca de restaurante.
  const handleReorder = useCallback(
    (order: Order) => {
      (order.items ?? []).forEach((orderItem) => {
        const qty = orderItem.qty ?? 1;
        for (let i = 0; i < qty; i++) {
          addItem(orderItem as any);
        }
      });
      navigation.navigate('Cart');
    },
    [addItem, navigation]
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
          contentContainerStyle={{ padding: 20, paddingTop: 4, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={54} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
              <Text style={styles.emptySub}>Seus pedidos vão aparecer aqui depois da primeira compra</Text>
            </View>
          }
          renderItem={({ item }: { item: Order }) => {
            const info = statusMap[item.status] ?? {
              label: item.status,
              color: colors.textMuted,
              icon: 'ellipse-outline' as const,
            };
            const itemsSummary = (item.items ?? []).map((it) => `${it.qty}x ${it.name}`).join(' · ');
            const isDelivered = item.status === 'entregue';

            return (
              <View style={styles.card}>
                {/* ---- Cabeçalho: logo do restaurante + nome + status ---- */}
                <View style={styles.cardHeader}>
                  {item.restaurantImage ? (
                    <Image
                      source={{ uri: item.restaurantImage }}
                      style={styles.logo}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={150}
                    />
                  ) : (
                    <View style={styles.logoFallback}>
                      <Ionicons name="storefront-outline" size={20} color={colors.primary} />
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.restaurantName} numberOfLines={1}>
                      {item.restaurantName}
                    </Text>
                    <Text style={styles.orderMeta}>
                      #{item.id.slice(-5).toUpperCase()} · {formatOrderDate(item.createdAt)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.badge, { backgroundColor: softBg(info.color) }]}>
                  <Ionicons name={info.icon} size={13} color={info.color} />
                  <Text style={[styles.badgeText, { color: info.color }]}>{info.label}</Text>
                </View>

                <View style={styles.divider} />

                {/* ---- Itens do pedido ---- */}
                <Text style={styles.itemsText} numberOfLines={2}>
                  {itemsSummary}
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
                  <View style={styles.cancelBanner}>
                    <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                    <Text style={styles.cancelReasonText}>{item.cancelReason}</Text>
                  </View>
                )}

                {/* ---- Rodapé: ação (conversar OU pedir de novo) + total ----
                    Enquanto o pedido está em andamento, faz sentido falar
                    com o restaurante. Depois de entregue, essa conversa já
                    não serve pra muito -- então trocamos pela ação que o
                    cliente realmente quer nesse ponto: repetir o pedido. */}
                <View style={styles.footerRow}>
                  {isDelivered ? (
                    <TouchableOpacity
                      style={styles.reorderBtn}
                      activeOpacity={0.8}
                      onPress={() => handleReorder(item)}
                    >
                      <Ionicons name="repeat-outline" size={15} color={colors.white} />
                      <Text style={styles.reorderBtnText}>Pedir novamente</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.chatBtn} activeOpacity={0.8} onPress={() => setChatOrder(item)}>
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.primary} />
                      <Text style={styles.chatBtnText}>Conversar</Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.totalWrap}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.total}>R$ {item.total.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {chatOrder && (
        <OrderChatModal
          visible={!!chatOrder}
          onClose={() => setChatOrder(null)}
          orderId={chatOrder.id}
          myRole="client"
          title={chatOrder.restaurantName}
          loadMessages={getOrderMessages}
          sendMessage={sendOrderMessage}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text, paddingHorizontal: 20, marginBottom: 10 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { ...typography.h2, color: colors.text, marginTop: 8 },
  emptySub: { color: colors.textMuted, textAlign: 'center', maxWidth: 260 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  logo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  logoFallback: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restaurantName: { ...typography.bodyBold, fontSize: 15.5, color: colors.text },
  orderMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  badgeText: { fontSize: 11.5, fontWeight: '700' },

  divider: { height: 1, backgroundColor: colors.border, marginBottom: 12 },

  itemsText: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 4 },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chatBtnText: { color: colors.primary, fontSize: 12.5, fontWeight: '700' },

  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reorderBtnText: { color: colors.white, fontSize: 12.5, fontWeight: '700' },

  totalWrap: { alignItems: 'flex-end' },
  totalLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  total: { ...typography.bodyBold, color: colors.primary, fontSize: 17 },

  codeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2, marginBottom: 4,
    backgroundColor: colors.secondaryLight, borderRadius: 14, padding: 12,
  },
  codeBannerLabel: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  codeBannerSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  deliveryCode: { ...typography.h2, color: colors.secondary, letterSpacing: 3 },

  cancelBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.danger + '14',
    borderRadius: 12,
    padding: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  cancelReasonText: { color: colors.danger, fontSize: 12.5, flex: 1, lineHeight: 17 },
});