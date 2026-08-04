import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
  MyDeliveryOrder,
  RadarOrder,
  acceptDelivery,
  confirmDelivery,
  confirmPickup,
  listAvailableOrders,
  listMyDeliveries,
  setAvailability,
} from '../../services/delivererService';
import { connectSocket, disconnectSocket } from '../../services/socket';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

function addressLine(o: { street?: string; number?: string; neighborhood?: string; city?: string }) {
  const parts = [o.street, o.number].filter(Boolean).join(', ');
  const rest = [o.neighborhood, o.city].filter(Boolean).join(' · ');
  return [parts, rest].filter(Boolean).join(' — ') || 'Endereço não informado';
}

export default function DelivererHomeScreen() {
  const { user, signOut } = useAuth();
  const [available, setAvailable] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const [radar, setRadar] = useState<RadarOrder[]>([]);
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const [activeOrder, setActiveOrder] = useState<MyDeliveryOrder | null>(null);
  const [history, setHistory] = useState<MyDeliveryOrder[]>([]);
  const [pickupCodeInput, setPickupCodeInput] = useState('');
  const [deliveryCodeInput, setDeliveryCodeInput] = useState('');
  const [confirming, setConfirming] = useState(false);

  const availableRef = useRef(available);
  availableRef.current = available;

  const loadMine = useCallback(async () => {
    try {
      const mine = await listMyDeliveries();
      const active = mine.find((o) => o.status === 'procurando_entregador' || o.status === 'a_caminho') || null;
      setActiveOrder(active);
      setHistory(mine.filter((o) => o.status === 'entregue' || o.status === 'cancelado'));
    } catch {
      // silencioso
    }
  }, []);

  const loadRadar = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoadingRadar(true);
    try {
      const orders = await listAvailableOrders();
      setRadar(orders);
    } catch {
      // silencioso
    } finally {
      isRefresh ? setRefreshing(false) : setLoadingRadar(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
    loadRadar();
  }, [loadMine, loadRadar]);

  // Radar em tempo real via socket: assim que um restaurante marca um pedido
  // como pronto, ele aparece aqui na hora — sem precisar dar refresh.
  useEffect(() => {
    let socketRef: Awaited<ReturnType<typeof connectSocket>> = null;

    connectSocket().then((s) => {
      socketRef = s;
      if (!s) return;

      s.on('order:available', (order: RadarOrder) => {
        setRadar((prev) => (prev.some((o) => o.id === order.id) ? prev : [...prev, order]));
      });

      s.on('order:taken', ({ id }: { id: string }) => {
        setRadar((prev) => prev.filter((o) => o.id !== id));
      });
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  async function handleToggleAvailability(value: boolean) {
    setTogglingAvailability(true);
    const previous = available;
    setAvailable(value);
    try {
      await setAvailability(value);
      if (value) {
        loadRadar();
      } else {
        setRadar([]);
      }
    } catch {
      setAvailable(previous);
      Alert.alert('Erro', 'Não foi possível atualizar sua disponibilidade.');
    } finally {
      setTogglingAvailability(false);
    }
  }

  async function handleAcceptOrder(order: RadarOrder) {
    setAcceptingId(order.id);
    try {
      await acceptDelivery(order.id);
      setRadar((prev) => prev.filter((o) => o.id !== order.id));
      await loadMine();
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Essa corrida já foi aceita por outro entregador.';
      Alert.alert('Não foi possível aceitar', message);
      loadRadar();
    } finally {
      setAcceptingId(null);
    }
  }

  async function handleConfirmPickup() {
    if (!activeOrder) return;
    if (pickupCodeInput.trim().length !== 4) {
      Alert.alert('Código inválido', 'Peça ao restaurante o código de 4 dígitos da retirada.');
      return;
    }
    setConfirming(true);
    try {
      await confirmPickup(activeOrder.id, pickupCodeInput.trim());
      setPickupCodeInput('');
      await loadMine();
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Código incorreto. Confira com o restaurante.';
      Alert.alert('Não foi possível confirmar', message);
    } finally {
      setConfirming(false);
    }
  }

  async function handleConfirmDelivery() {
    if (!activeOrder) return;
    if (deliveryCodeInput.trim().length !== 4) {
      Alert.alert('Código inválido', 'Peça ao cliente o código de 4 dígitos da entrega.');
      return;
    }
    setConfirming(true);
    try {
      await confirmDelivery(activeOrder.id, deliveryCodeInput.trim());
      setDeliveryCodeInput('');
      setActiveOrder(null);
      await loadMine();
      await loadRadar();
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Código incorreto. Confira com o cliente.';
      Alert.alert('Não foi possível confirmar', message);
    } finally {
      setConfirming(false);
    }
  }

  const deliveriesToday = history.filter(
    (o) => o.status === 'entregue' && new Date(o.deliveredAt || o.createdAt).toDateString() === new Date().toDateString()
  );
  const earningsToday = deliveriesToday.reduce((sum, o) => sum + Number(o.deliveryFee || 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadRadar(true);
              loadMine();
            }}
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hello}>Olá, {user?.name}</Text>
            <Text style={styles.sub}>Painel do entregador</Text>
          </View>
          <TouchableOpacity onPress={signOut}>
            <Ionicons name="log-out-outline" size={24} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>
              {available ? 'Disponível para entregas' : 'Indisponível'}
            </Text>
            <Text style={styles.statusSub}>
              {available ? 'Você está no radar de corridas próximas' : 'Ative para começar a receber pedidos'}
            </Text>
          </View>
          <Switch
            value={available}
            onValueChange={handleToggleAvailability}
            disabled={togglingAvailability || !!activeOrder}
            trackColor={{ true: colors.secondary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="navigate-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{deliveriesToday.length}</Text>
            <Text style={styles.statLabel}>Entregas hoje</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet-outline" size={20} color={colors.secondary} />
            <Text style={styles.statValue}>R$ {earningsToday.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Ganhos hoje</Text>
          </View>
        </View>

        {activeOrder ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Entrega em andamento</Text>
            <View style={styles.activeCard}>
              <Text style={styles.activeRestaurant}>{activeOrder.restaurantName}</Text>
              <Text style={styles.activeAddress}>{addressLine(activeOrder)}</Text>
              <Text style={styles.activeTotal}>Pedido #{activeOrder.id.slice(-5)} · R$ {Number(activeOrder.total).toFixed(2)}</Text>

              {activeOrder.status === 'procurando_entregador' && (
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>Peça ao restaurante o código de retirada</Text>
                  <View style={styles.codeRow}>
                    <TextInput
                      style={styles.codeInput}
                      value={pickupCodeInput}
                      onChangeText={setPickupCodeInput}
                      placeholder="0000"
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                    <TouchableOpacity
                      style={[styles.confirmBtn, confirming && { opacity: 0.6 }]}
                      onPress={handleConfirmPickup}
                      disabled={confirming}
                    >
                      {confirming ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.confirmBtnText}>Confirmar retirada</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {activeOrder.status === 'a_caminho' && (
                <View style={styles.codeBox}>
                  <Text style={styles.codeLabel}>Peça ao cliente o código de entrega</Text>
                  <View style={styles.codeRow}>
                    <TextInput
                      style={styles.codeInput}
                      value={deliveryCodeInput}
                      onChangeText={setDeliveryCodeInput}
                      placeholder="0000"
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                    <TouchableOpacity
                      style={[styles.confirmBtn, confirming && { opacity: 0.6 }]}
                      onPress={handleConfirmDelivery}
                      disabled={confirming}
                    >
                      {confirming ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.confirmBtnText}>Confirmar entrega</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Radar de corridas</Text>
            {!available ? (
              <View style={styles.emptyBox}>
                <Ionicons name="radio-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>Você está indisponível</Text>
                <Text style={styles.emptySub}>Ative o modo disponível para começar a ver corridas no radar</Text>
              </View>
            ) : loadingRadar ? (
              <View style={styles.emptyBox}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : radar.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="bicycle-outline" size={40} color={colors.textMuted} />
                <Text style={styles.emptyText}>Procurando corridas...</Text>
                <Text style={styles.emptySub}>Assim que um restaurante marcar um pedido como pronto, ele aparece aqui na hora</Text>
              </View>
            ) : (
              radar.map((order) => (
                <View key={order.id} style={styles.radarCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.radarRestaurant}>{order.restaurantName}</Text>
                    <Text style={styles.radarAddress}>{addressLine(order)}</Text>
                    <Text style={styles.radarTotal}>Pedido #{order.id.slice(-5)} · R$ {Number(order.total).toFixed(2)}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.acceptBtn, acceptingId === order.id && { opacity: 0.6 }]}
                    onPress={() => handleAcceptOrder(order)}
                    disabled={acceptingId === order.id}
                  >
                    {acceptingId === order.id ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.acceptBtnText}>Aceitar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hello: { ...typography.h1, color: colors.text },
  sub: { color: colors.textMuted, marginTop: 2 },
  statusCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginTop: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  statusTitle: { ...typography.bodyBold, color: colors.text },
  statusSub: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  statValue: { ...typography.h1, color: colors.text },
  statLabel: { color: colors.textMuted, fontSize: 12 },
  section: { marginTop: 26 },
  sectionTitle: { ...typography.h2, color: colors.text, marginBottom: 12 },
  emptyBox: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 16, padding: 30,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { ...typography.bodyBold, color: colors.text, marginTop: 4 },
  emptySub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
  radarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  radarRestaurant: { ...typography.bodyBold, color: colors.text },
  radarAddress: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  radarTotal: { color: colors.text, fontSize: 12.5, marginTop: 4, fontWeight: '700' },
  acceptBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
    minWidth: 90, alignItems: 'center', justifyContent: 'center',
  },
  acceptBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  activeCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: colors.border, gap: 4,
  },
  activeRestaurant: { ...typography.h2, color: colors.text },
  activeAddress: { color: colors.textMuted, fontSize: 13 },
  activeTotal: { color: colors.text, fontWeight: '700', marginTop: 6 },
  codeBox: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  codeLabel: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginBottom: 8 },
  codeRow: { flexDirection: 'row', gap: 10 },
  codeInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 18, color: colors.text, backgroundColor: colors.background,
    width: 100, textAlign: 'center', letterSpacing: 4, fontWeight: '700',
  },
  confirmBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
