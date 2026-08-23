import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import OrderChatModal from '../../components/OrderChatModal';
import RatingModal from '../../components/RatingModal';
import { PixPaymentModal } from '../../components/PixPaymentModal';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { PressableScale } from '../../components/PressableScale';
import { useCart } from '../../context/CartContext';
import {
  cancelOrder,
  getOrderMessages,
  listMyOrders,
  payOrderPix,
  PixPayment,
  rateOrder,
  sendOrderMessage,
} from '../../services/orderService';
import { connectSocket, disconnectSocket } from '../../services/socket';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { Order, OrderStatus } from '../../types';

// Rótulo curto pra dizer ao cliente o que ele vai pagar na entrega
const ENTREGA_PAYMENT_LABEL: Record<string, string> = {
  pix_entrega: 'no Pix',
  dinheiro: 'em dinheiro',
  cartao_credito: 'no cartão de crédito',
  cartao_debito: 'no cartão de débito',
};

// Status com cor + ícone próprios — usados tanto no badge (fundo suave,
// texto colorido) quanto pra decidir se ainda vale mostrar o código de
// entrega, etc.
function getStatusMap(
  colors: ThemeColors
): Record<OrderStatus, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> {
  return {
    pendente: { label: 'Aguardando restaurante', color: colors.primary, icon: 'hourglass-outline' },
    preparando: { label: 'Preparando', color: '#B8860B', icon: 'restaurant-outline' },
    procurando_entregador: { label: 'Buscando entregador', color: colors.secondary, icon: 'search-outline' },
    a_caminho: { label: 'A caminho', color: colors.secondary, icon: 'bicycle-outline' },
    entregue: { label: 'Entregue', color: '#4A9B6E', icon: 'checkmark-circle-outline' },
    cancelado: { label: 'Cancelado', color: colors.danger, icon: 'close-circle-outline' },
  };
}

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
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const statusMap = getStatusMap(colors);
  const navigation = useNavigation<any>();
  const { addItem } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [chatOrder, setChatOrder] = useState<Order | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);

  // Página fixa de 20 pedidos por vez -- igual ao padrão do backend
  // (ver orders.service.js). A tela pede a próxima página sozinha quando
  // o usuário chega perto do fim da lista (onEndReached).
  const PAGE_SIZE = 20;

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await listMyOrders({ limit: PAGE_SIZE, offset: 0 });
      setOrders(data);
      setHasMore(data.length >= PAGE_SIZE);
    } catch {
      // silencioso: mantém a última lista carregada
    } finally {
      isRefresh ? setRefreshing(false) : setLoading(false);
    }
  }, []);

  // Busca a próxima página e concatena no final da lista já carregada --
  // sem isso, a tela buscaria o histórico inteiro do cliente de uma vez.
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading || refreshing) return;
    setLoadingMore(true);
    try {
      const next = await listMyOrders({ limit: PAGE_SIZE, offset: orders.length });
      setOrders((prev) => [...prev, ...next]);
      setHasMore(next.length >= PAGE_SIZE);
    } catch {
      // silencioso
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, refreshing, orders.length]);

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
      // Confirmação/recusa do pagamento chega aqui assim que o Mercado Pago
      // avisa o backend (webhook) -- geralmente segundos depois do cliente
      // pagar, mesmo que ele já tenha voltado pro app.
      s.on('order:payment', ({ id, paymentStatus }: { id: string; paymentStatus: Order['paymentStatus'] }) => {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, paymentStatus } : o)));
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

  // Retoma o pagamento de um pedido criado mas ainda não pago (ex: o
  // cliente fechou o navegador do checkout sem terminar de pagar).
  const handlePayNow = useCallback(async (order: Order) => {
    setPayingId(order.id);
    setPixOrderId(order.id);
    setPixModalVisible(true);
    try {
      const payment = await payOrderPix(order.id);
      setPixPayment(payment);
    } catch (err: any) {
      setPixModalVisible(false);
      const message = err?.response?.data?.error || 'Não foi possível gerar o Pix agora.';
      Alert.alert('Erro', message);
    } finally {
      setPayingId(null);
    }
  }, []);

  // Só funciona enquanto o restaurante ainda não aceitou o pedido -- passado
  // isso, o backend recusa (409) e sugerimos falar com o restaurante pelo chat.
  const handleCancelOrder = useCallback((order: Order) => {
    Alert.alert('Cancelar pedido', 'Tem certeza que deseja cancelar este pedido?', [
      { text: 'Manter pedido', style: 'cancel' },
      {
        text: 'Cancelar pedido',
        style: 'destructive',
        onPress: async () => {
          setCancelingId(order.id);
          try {
            await cancelOrder(order.id);
            setOrders((prev) =>
              prev.map((o) =>
                o.id === order.id ? { ...o, status: 'cancelado', cancelReason: 'Cancelado por você' } : o
              )
            );
          } catch (err: any) {
            const message =
              err?.response?.status === 409
                ? 'Não foi possível cancelar: o restaurante já começou a preparar o pedido. Fale com ele pelo chat.'
                : 'Não foi possível cancelar o pedido. Tente novamente.';
            Alert.alert('Erro', message);
          } finally {
            setCancelingId(null);
          }
        },
      },
    ]);
  }, []);

  // Só funciona pra pedidos já entregues, e uma vez só -- o backend recusa
  // (409) numa segunda tentativa, o que o próprio RatingModal já trata.
  const handleSubmitRating = useCallback(
    async (rating: number, comment?: string) => {
      if (!ratingOrder) return;
      const saved = await rateOrder(ratingOrder.id, rating, comment);
      setOrders((prev) =>
        prev.map((o) => (o.id === ratingOrder.id ? { ...o, myRating: saved.rating, myRatingComment: saved.comment } : o))
      );
      setRatingOrder(null);
    },
    [ratingOrder]
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
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <FadeSlideIn style={styles.emptyWrap}>
              <Ionicons name="receipt-outline" size={54} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum pedido ainda</Text>
              <Text style={styles.emptySub}>Seus pedidos vão aparecer aqui depois da primeira compra</Text>
            </FadeSlideIn>
          }
          renderItem={({ item, index }: { item: Order; index: number }) => {
            const info = statusMap[item.status] ?? {
              label: item.status,
              color: colors.textMuted,
              icon: 'ellipse-outline' as const,
            };
            const itemsSummary = (item.items ?? []).map((it) => `${it.qty}x ${it.name}`).join(' · ');
            const isDelivered = item.status === 'entregue';

            return (
              <FadeSlideIn index={index} style={styles.card}>
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

                {/* Enquanto o pedido está "pendente" (restaurante ainda não
                    viu), o status do pagamento é a informação que mais
                    importa pro cliente -- é o que decide se o pedido vai
                    ou não avançar. Isso só se aplica a pagamento feito no
                    app (Pix no app / Mercado Pago) -- pedidos com
                    pagamento na entrega já foram enviados ao restaurante
                    na hora, então mostram só um aviso do que vai pagar. */}
                {item.status === 'pendente' && item.paymentTiming === 'entrega' && (
                  <View style={styles.paymentBanner}>
                    <Ionicons name="cash-outline" size={16} color="#B5760A" />
                    <Text style={styles.paymentBannerText}>
                      Pague {ENTREGA_PAYMENT_LABEL[item.paymentMethod || ''] || ''} na entrega
                      {item.paymentMethod === 'dinheiro' && item.changeFor
                        ? ` · troco p/ R$ ${Number(item.changeFor).toFixed(2)}`
                        : ''}
                    </Text>
                  </View>
                )}

                {item.status === 'pendente' && item.paymentTiming !== 'entrega' && item.paymentStatus !== 'pago' && (
                  <View
                    style={[
                      styles.paymentBanner,
                      item.paymentStatus === 'recusado' && styles.paymentBannerDanger,
                    ]}
                  >
                    <Ionicons
                      name={item.paymentStatus === 'recusado' ? 'close-circle-outline' : 'time-outline'}
                      size={16}
                      color={item.paymentStatus === 'recusado' ? colors.danger : '#B5760A'}
                    />
                    <Text
                      style={[
                        styles.paymentBannerText,
                        item.paymentStatus === 'recusado' && { color: colors.danger },
                      ]}
                    >
                      {item.paymentStatus === 'recusado'
                        ? 'Pagamento recusado'
                        : 'Aguardando pagamento'}
                    </Text>
                    <PressableScale
                      style={styles.payNowBtn}
                      onPress={() => handlePayNow(item)}
                      disabled={payingId === item.id}
                      scaleTo={0.95}
                    >
                      {payingId === item.id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.payNowBtnText}>Pagar agora</Text>
                      )}
                    </PressableScale>
                  </View>
                )}

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

                {item.status === 'pendente' && (
                  <PressableScale
                    style={[styles.cancelOrderBtn, cancelingId === item.id && { opacity: 0.6 }]}
                    onPress={() => handleCancelOrder(item)}
                    disabled={cancelingId === item.id}
                    scaleTo={0.97}
                  >
                    {cancelingId === item.id ? (
                      <ActivityIndicator color={colors.danger} size="small" />
                    ) : (
                      <>
                        <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
                        <Text style={styles.cancelOrderBtnText}>Cancelar pedido</Text>
                      </>
                    )}
                  </PressableScale>
                )}

                {isDelivered && (
                  item.myRating ? (
                    <View style={styles.ratingDoneBanner}>
                      <View style={{ flexDirection: 'row', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Ionicons
                            key={n}
                            name={n <= item.myRating! ? 'star' : 'star-outline'}
                            size={13}
                            color="#F5A623"
                          />
                        ))}
                      </View>
                      <Text style={styles.ratingDoneText}>Você avaliou esse pedido</Text>
                    </View>
                  ) : (
                    <PressableScale
                      style={styles.rateBtn}
                      onPress={() => setRatingOrder(item)}
                      scaleTo={0.97}
                    >
                      <Ionicons name="star-outline" size={15} color="#F5A623" />
                      <Text style={styles.rateBtnText}>Avaliar pedido</Text>
                    </PressableScale>
                  )
                )}

                {/* ---- Rodapé: ação (conversar OU pedir de novo) + total ----
                    Enquanto o pedido está em andamento, faz sentido falar
                    com o restaurante. Depois de entregue, essa conversa já
                    não serve pra muito -- então trocamos pela ação que o
                    cliente realmente quer nesse ponto: repetir o pedido. */}
                <View style={styles.footerRow}>
                  {isDelivered ? (
                    <PressableScale
                      style={styles.reorderBtn}
                      onPress={() => handleReorder(item)}
                      scaleTo={0.95}
                    >
                      <Ionicons name="repeat-outline" size={15} color={colors.white} />
                      <Text style={styles.reorderBtnText}>Pedir novamente</Text>
                    </PressableScale>
                  ) : (
                    <PressableScale style={styles.chatBtn} onPress={() => setChatOrder(item)} scaleTo={0.95}>
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.primary} />
                      <Text style={styles.chatBtnText}>Conversar</Text>
                    </PressableScale>
                  )}

                  <View style={styles.totalWrap}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.total}>R$ {item.total.toFixed(2)}</Text>
                  </View>
                </View>
              </FadeSlideIn>
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

      {ratingOrder && (
        <RatingModal
          visible={!!ratingOrder}
          onClose={() => setRatingOrder(null)}
          restaurantName={ratingOrder.restaurantName}
          onSubmit={handleSubmitRating}
        />
      )}

      <PixPaymentModal
        visible={pixModalVisible}
        orderId={pixOrderId ?? ''}
        payment={pixPayment}
        onClose={() => {
          setPixModalVisible(false);
          setPixPayment(null);
        }}
        onPaid={() => {
          setPixModalVisible(false);
          setPixPayment(null);
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
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
    ...shadows.sm,
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

  paymentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F5A62314', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12,
  },
  paymentBannerDanger: { backgroundColor: colors.danger + '14' },
  paymentBannerText: { flex: 1, color: '#B5760A', fontSize: 12.5, fontWeight: '700' },
  payNowBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  payNowBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },

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

  cancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: 12,
    paddingVertical: 9,
    marginTop: 4,
    marginBottom: 4,
  },
  cancelOrderBtnText: { color: colors.danger, fontSize: 12.5, fontWeight: '700' },

  rateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#F5A62355', backgroundColor: '#F5A62314',
    borderRadius: 12, paddingVertical: 9, marginTop: 4, marginBottom: 4,
  },
  rateBtnText: { color: '#B5760A', fontSize: 12.5, fontWeight: '700' },
  ratingDoneBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 4, marginBottom: 4,
  },
  ratingDoneText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  });
}