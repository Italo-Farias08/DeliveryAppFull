import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import OrderChatModal from '../../components/OrderChatModal';
import RestaurantScreenLayout from '../../components/RestaurantScreenLayout';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { PressableScale } from '../../components/PressableScale';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import {
  TenantOrder,
  acceptOrder,
  getTenantOrderMessages,
  markOrderReady,
  rejectOrder,
  sendTenantOrderMessage,
} from '../../services/tenantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows, coloredShadow } from '../../theme/shadows';
import { OrderStatus } from '../../types';

const statusLabel: Record<OrderStatus, string> = {
  pendente: 'Novo pedido',
  preparando: 'Preparando',
  procurando_entregador: 'Buscando entregador',
  a_caminho: 'A caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

function getStatusColor(colors: ThemeColors): Record<OrderStatus, string> {
  return {
    pendente: colors.primary,
    preparando: colors.star,
    procurando_entregador: colors.secondary,
    a_caminho: colors.secondary,
    entregue: colors.textMuted,
    cancelado: colors.danger,
  };
}

// Ícone por status — reforça o significado da cor pra quem só olha rápido
// (útil na correria da cozinha).
const statusIcon: Record<OrderStatus, keyof typeof Ionicons.glyphMap> = {
  pendente: 'alert-circle',
  preparando: 'flame',
  procurando_entregador: 'bicycle',
  a_caminho: 'navigate',
  entregue: 'checkmark-done-circle',
  cancelado: 'close-circle',
};

export default function RestaurantOrdersScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const statusColor = getStatusColor(colors);
  const { orders, setOrders, refreshing, reload, pendingCount, ownDeliverers } = useRestaurantPanel();
  const [delivererPickerOrder, setDelivererPickerOrder] = useState<TenantOrder | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [chatOrder, setChatOrder] = useState<TenantOrder | null>(null);

  async function handleAcceptOrder(order: TenantOrder) {
    setSavingOrderId(order.id);
    try {
      await acceptOrder(order.id);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'preparando' } : o)));
    } catch {
      Alert.alert('Erro', 'Não foi possível aceitar o pedido.');
    } finally {
      setSavingOrderId(null);
    }
  }

  function handleRejectOrder(order: TenantOrder) {
    Alert.alert('Recusar pedido', 'Tem certeza que deseja recusar este pedido?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Recusar',
        style: 'destructive',
        onPress: async () => {
          setSavingOrderId(order.id);
          try {
            await rejectOrder(order.id);
            setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'cancelado' } : o)));
          } catch {
            Alert.alert('Erro', 'Não foi possível recusar o pedido.');
          } finally {
            setSavingOrderId(null);
          }
        },
      },
    ]);
  }

  async function handleMarkReady(order: TenantOrder, delivererId?: string) {
    setSavingOrderId(order.id);
    try {
      await markOrderReady(order.id, delivererId);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'procurando_entregador' } : o)));
    } catch (err: any) {
      Alert.alert('Erro', err?.response?.data?.error || 'Não foi possível marcar o pedido como pronto.');
    } finally {
      setSavingOrderId(null);
    }
  }

  // "Usar meu entregador": se só tem um da casa disponível, atribui direto
  // (menos toque, mais rápido no correria da cozinha). Com mais de um,
  // abre a lista pra escolher qual vai buscar esse pedido.
  function handlePickOwnDeliverer(order: TenantOrder) {
    const available = ownDeliverers.filter((d) => d.isAvailable);
    if (available.length === 0) {
      Alert.alert(
        'Nenhum entregador disponível',
        'Seus entregadores da casa estão todos indisponíveis agora. Chame um entregador pelo radar, ou tente de novo em instantes.'
      );
      return;
    }
    if (available.length === 1) {
      handleMarkReady(order, available[0].id);
      return;
    }
    setDelivererPickerOrder(order);
  }

  return (
    <RestaurantScreenLayout
      title="Pedidos"
      subtitle={pendingCount > 0 ? `${pendingCount} novo${pendingCount > 1 ? 's' : ''}` : 'Tudo em dia'}
      active="Orders"
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => reload(true)} tintColor={colors.primary} />}
      >
        {orders.length === 0 ? (
          <FadeSlideIn style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="fast-food-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.emptyText}>Nenhum pedido ainda</Text>
            <Text style={styles.emptySub}>Os pedidos dos clientes vão aparecer aqui</Text>
          </FadeSlideIn>
        ) : (
          orders.map((order, index) => {
            const saving = savingOrderId === order.id;
            const addressLine = [order.street, order.number].filter(Boolean).join(', ');
            const addressRest = [order.neighborhood, order.city].filter(Boolean).join(' · ');
            const mapsUrl = order.lat && order.lng
              ? `https://www.google.com/maps/search/?api=1&query=${order.lat},${order.lng}`
              : addressLine
              ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${addressLine} ${addressRest}`)}`
              : null;
            const sColor = statusColor[order.status] ?? colors.textMuted;
            return (
              <FadeSlideIn key={order.id} index={index} style={styles.orderCard}>
                <View style={styles.orderCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderId}>Pedido #{order.id.slice(-5)}</Text>
                    <Text style={styles.orderTotal}>R$ {Number(order.total).toFixed(2)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${sColor}1A`, borderColor: `${sColor}40` }]}>
                    <Ionicons name={statusIcon[order.status] ?? 'ellipse'} size={12} color={sColor} />
                    <Text style={[styles.statusBadgeText, { color: sColor }]}>{statusLabel[order.status] ?? order.status}</Text>
                  </View>
                </View>

                <View style={styles.clientInfoBox}>
                  <View style={styles.clientAvatar}>
                    <Ionicons name="person" size={15} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{order.clientName || 'Cliente'}</Text>
                    {!!order.clientPhone && <Text style={styles.clientDetail}>{order.clientPhone}</Text>}
                    {!!(addressLine || addressRest) && (
                      <Text style={styles.clientDetail}>
                        {[addressLine, addressRest].filter(Boolean).join(' — ')}
                      </Text>
                    )}
                    {mapsUrl && (
                      <PressableScale onPress={() => Linking.openURL(mapsUrl)} style={styles.mapLinkRow} scaleTo={0.95}>
                        <Ionicons name="location-outline" size={13} color={colors.secondary} />
                        <Text style={styles.mapLinkText}>Ver localização no mapa</Text>
                      </PressableScale>
                    )}
                  </View>
                  <PressableScale style={styles.chatBtn} onPress={() => setChatOrder(order)} scaleTo={0.9}>
                    <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.primary} />
                  </PressableScale>
                </View>

                {(order.items ?? []).length > 0 && (
                  <View style={styles.orderItemsBox}>
                    {order.items.map((it, idx) => (
                      <View
                        key={it.id}
                        style={[styles.itemRow, idx > 0 && styles.itemRowDivider]}
                      >
                        <View style={styles.itemQtyBadge}>
                          <Text style={styles.itemQtyBadgeText}>{it.qty}x</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{it.name}</Text>

                          {!!it.addons && it.addons.length > 0 && (
                            <View style={styles.itemDetailRow}>
                              <Ionicons name="add-circle-outline" size={13} color={colors.secondary} />
                              <Text style={styles.itemAddonsText}>
                                {it.addons.map((a) => a.name).join(', ')}
                              </Text>
                            </View>
                          )}

                          {!!it.notes && (
                            <View style={[styles.itemDetailRow, styles.itemNotesBox]}>
                              <Ionicons name="chatbox-ellipses-outline" size={13} color={colors.star} />
                              <Text style={styles.itemNotesText}>{it.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {order.status === 'pendente' && (
                  <View style={styles.orderActionsRow}>
                    <PressableScale
                      style={[styles.outlineSmallBtn, saving && { opacity: 0.6 }]}
                      onPress={() => handleRejectOrder(order)}
                      disabled={saving}
                      scaleTo={0.95}
                    >
                      <Text style={styles.outlineSmallBtnText}>Recusar</Text>
                    </PressableScale>
                    <PressableScale
                      style={[styles.advanceBtn, { flex: 1 }, saving && { opacity: 0.6 }]}
                      onPress={() => handleAcceptOrder(order)}
                      disabled={saving}
                      scaleTo={0.97}
                    >
                      {saving ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.advanceBtnText}>Aceitar pedido</Text>
                      )}
                    </PressableScale>
                  </View>
                )}

                {order.status === 'preparando' && (
                  ownDeliverers.length === 0 ? (
                    <PressableScale
                      style={[styles.advanceBtn, styles.advanceBtnFull, saving && { opacity: 0.6 }]}
                      onPress={() => handleMarkReady(order)}
                      disabled={saving}
                      scaleTo={0.97}
                    >
                      {saving ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.advanceBtnText}>Pedido pronto — chamar entregador</Text>
                      )}
                    </PressableScale>
                  ) : (
                    <View style={styles.readyChoiceRow}>
                      <PressableScale
                        style={[styles.readyChoiceBtn, saving && { opacity: 0.6 }]}
                        onPress={() => handleMarkReady(order)}
                        disabled={saving}
                        scaleTo={0.95}
                      >
                        <Ionicons name="radio-outline" size={15} color={colors.primary} />
                        <Text style={styles.readyChoiceBtnText}>Chamar entregador</Text>
                      </PressableScale>
                      <PressableScale
                        style={[styles.readyChoiceBtn, styles.readyChoiceBtnFilled, saving && { opacity: 0.6 }]}
                        onPress={() => handlePickOwnDeliverer(order)}
                        disabled={saving}
                        scaleTo={0.95}
                      >
                        {saving ? (
                          <ActivityIndicator color={colors.white} />
                        ) : (
                          <>
                            <Ionicons name="bicycle" size={15} color={colors.white} />
                            <Text style={styles.readyChoiceBtnTextFilled}>Usar meu entregador</Text>
                          </>
                        )}
                      </PressableScale>
                    </View>
                  )
                )}

                {order.status === 'procurando_entregador' && (
                  <View style={styles.codeBanner}>
                    <View style={styles.codeBannerIconWrap}>
                      <Ionicons name="bicycle-outline" size={17} color={colors.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codeBannerLabel}>Buscando entregador</Text>
                      <Text style={styles.codeBannerSub}>
                        Quando ele chegar, confira este código antes de entregar o pedido
                      </Text>
                    </View>
                    <Text style={styles.pickupCode}>{order.pickupCode}</Text>
                  </View>
                )}

                {order.status === 'a_caminho' && (
                  <View style={styles.codeBanner}>
                    <View style={styles.codeBannerIconWrap}>
                      <Ionicons name="checkmark-circle-outline" size={17} color={colors.secondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codeBannerLabel}>A caminho do cliente</Text>
                      <Text style={styles.codeBannerSub}>
                        {order.delivererName ? `Entregador: ${order.delivererName}` : 'Entregador a caminho'}
                      </Text>
                    </View>
                  </View>
                )}
              </FadeSlideIn>
            );
          })
        )}
      </ScrollView>

      {chatOrder && (
        <OrderChatModal
          visible={!!chatOrder}
          onClose={() => setChatOrder(null)}
          orderId={chatOrder.id}
          myRole="restaurant"
          title={chatOrder.clientName || `Pedido #${chatOrder.id.slice(-5)}`}
          loadMessages={getTenantOrderMessages}
          sendMessage={sendTenantOrderMessage}
        />
      )}

      <Modal
        visible={!!delivererPickerOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setDelivererPickerOrder(null)}
      >
        <View style={styles.pickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDelivererPickerOrder(null)} />
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Qual entregador vai buscar?</Text>
            {ownDeliverers
              .filter((d) => d.isAvailable)
              .map((d) => (
                <PressableScale
                  key={d.id}
                  style={styles.pickerRow}
                  onPress={() => {
                    const order = delivererPickerOrder;
                    setDelivererPickerOrder(null);
                    if (order) handleMarkReady(order, d.id);
                  }}
                  scaleTo={0.97}
                >
                  <View style={styles.pickerAvatar}>
                    <Ionicons name="bicycle" size={16} color={colors.primary} />
                  </View>
                  <Text style={styles.pickerRowText}>{d.name}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </PressableScale>
              ))}
            <PressableScale style={styles.pickerCancel} onPress={() => setDelivererPickerOrder(null)} scaleTo={0.95}>
              <Text style={styles.pickerCancelText}>Cancelar</Text>
            </PressableScale>
          </View>
        </View>
      </Modal>
    </RestaurantScreenLayout>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  emptyBox: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 20, padding: 32,
    ...shadows.sm,
  },
  emptyIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyText: { ...typography.bodyBold, color: colors.text, marginTop: 4 },
  emptySub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },

  advanceBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    ...coloredShadow(colors.primary, 0.25),
  },
  advanceBtnFull: { marginTop: 10 },

  readyChoiceRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  readyChoiceBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingVertical: 11,
  },
  readyChoiceBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12.5 },
  readyChoiceBtnFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
  readyChoiceBtnTextFilled: { color: colors.white, fontWeight: '700', fontSize: 12.5 },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pickerCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: 18, padding: 16, ...shadows.lg },
  pickerTitle: { ...typography.bodyBold, color: colors.text, fontSize: 15, marginBottom: 10 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerAvatar: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerRowText: { flex: 1, color: colors.text, fontWeight: '600', fontSize: 14 },
  pickerCancel: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  pickerCancelText: { color: colors.textMuted, fontWeight: '700' },
  advanceBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  orderCard: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 18,
    ...shadows.sm,
  },
  orderCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  orderId: { ...typography.bodyBold, color: colors.text },
  orderTotal: { color: colors.textMuted, fontSize: 12.5, marginTop: 2, fontWeight: '600' },

  clientInfoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  clientAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  clientName: { ...typography.bodyBold, color: colors.text, fontSize: 13.5 },
  clientDetail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  mapLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  mapLinkText: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  chatBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  orderItemsBox: {
    marginTop: 10, backgroundColor: colors.background, borderRadius: 10, padding: 10,
  },
  // cada item do pedido vira sua própria "linha", com um separador fino
  // entre um item e o próximo -- é isso que resolve o pedido ficar tudo
  // colado numa frase só.
  itemRow: { flexDirection: 'row', gap: 8, paddingVertical: 8 },
  itemRowDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  itemQtyBadge: {
    minWidth: 28, height: 22, borderRadius: 7, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  itemQtyBadgeText: { color: colors.primary, fontSize: 11.5, fontWeight: '800' },
  itemName: { color: colors.text, fontSize: 13.5, fontWeight: '700' },
  // linha própria pra cada tipo de detalhe (adicional / observação), com
  // ícone diferente, pra ficar óbvio o que é o quê num relance
  itemDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4 },
  itemAddonsText: { flex: 1, color: colors.secondary, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  itemNotesBox: {
    backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5,
  },
  itemNotesText: { flex: 1, color: colors.primaryDark, fontSize: 12, fontWeight: '600', lineHeight: 16 },

  orderActionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  outlineSmallBtn: {
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
  },
  outlineSmallBtnText: { color: colors.danger, fontWeight: '700', fontSize: 12.5 },

  codeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12,
    backgroundColor: colors.secondaryLight, borderRadius: 14, padding: 12,
  },
  codeBannerIconWrap: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  codeBannerLabel: { ...typography.bodyBold, color: colors.text, fontSize: 13 },
  codeBannerSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  pickupCode: { ...typography.h2, color: colors.secondary, letterSpacing: 3 },
  });
}
