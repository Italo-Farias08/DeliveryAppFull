import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
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
import DeleteAccountModal from '../../components/DeleteAccountModal';
import OrderChatModal from '../../components/OrderChatModal';
import { useAuth } from '../../context/AuthContext';
import { deleteAccount } from '../../services/userService';
import {
  MyDeliveryOrder,
  RadarOrder,
  abandonDelivery,
  acceptDelivery,
  confirmDelivery,
  confirmPickup,
  getDelivererOrderMessages,
  DelivererProfile,
  getDelivererProfile,
  linkToRestaurant,
  listAvailableOrders,
  listMyDeliveries,
  sendDelivererOrderMessage,
  setAvailability,
  unlinkFromRestaurant,
} from '../../services/delivererService';
import { connectSocket, disconnectSocket } from '../../services/socket';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';

// Se o backend passar a mandar lat/lng no pedido, esses campos são
// usados automaticamente para abrir a rota com coordenadas exatas.
// Enquanto isso não existir, cai para busca por endereço (funciona
// igual no Waze e no Google Maps, só é um pouco menos preciso).
type WithCoords = { lat?: number; lng?: number };
type PlainAddress = { street?: string; number?: string; neighborhood?: string; city?: string } & WithCoords;

function addressLine(o: { street?: string; number?: string; neighborhood?: string; city?: string }) {
  const parts = [o.street, o.number].filter(Boolean).join(', ');
  const rest = [o.neighborhood, o.city].filter(Boolean).join(' · ');
  const full = [parts, rest].filter(Boolean).join(' — ');
  return full || null;
}

// Endereço da loja (pra retirar o pedido) — separado do endereço do
// cliente (pra entregar). Vem com prefixo "restaurant" desde o backend
// exatamente pra nunca ser confundido com o endereço de entrega.
type WithRestaurantAddress = {
  restaurantStreet?: string;
  restaurantNumber?: string;
  restaurantNeighborhood?: string;
  restaurantCity?: string;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
};

function restaurantDestination(o: WithRestaurantAddress): PlainAddress {
  return {
    street: o.restaurantStreet,
    number: o.restaurantNumber,
    neighborhood: o.restaurantNeighborhood,
    city: o.restaurantCity,
    lat: o.restaurantLat ?? undefined,
    lng: o.restaurantLng ?? undefined,
  };
}

function clientDestination(o: { street?: string; number?: string; neighborhood?: string; city?: string } & WithCoords): PlainAddress {
  return { street: o.street, number: o.number, neighborhood: o.neighborhood, city: o.city, lat: o.lat, lng: o.lng };
}

function openNavigation(destination: PlainAddress) {
  const line = addressLine(destination);
  const hasCoords = typeof destination.lat === 'number' && typeof destination.lng === 'number';
  if (!hasCoords && !line) {
    Alert.alert('Endereço indisponível', 'Esse endereço ainda não foi cadastrado.');
    return;
  }
  const query = encodeURIComponent(line || '');

  const wazeAppUrl = hasCoords
    ? `waze://?ll=${destination.lat},${destination.lng}&navigate=yes`
    : `waze://?q=${query}&navigate=yes`;
  const wazeWebUrl = hasCoords
    ? `https://waze.com/ul?ll=${destination.lat},${destination.lng}&navigate=yes`
    : `https://waze.com/ul?q=${query}&navigate=yes`;
  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${query}`;

  Alert.alert('Abrir rota', 'Escolha o app de navegação', [
    {
      text: 'Waze',
      onPress: async () => {
        try {
          const supported = await Linking.canOpenURL(wazeAppUrl);
          await Linking.openURL(supported ? wazeAppUrl : wazeWebUrl);
        } catch {
          Alert.alert('Erro', 'Não foi possível abrir o Waze. Ele está instalado?');
        }
      },
    },
    {
      text: 'Google Maps',
      onPress: async () => {
        try {
          await Linking.openURL(googleMapsUrl);
        } catch {
          Alert.alert('Erro', 'Não foi possível abrir o Google Maps.');
        }
      },
    },
    { text: 'Cancelar', style: 'cancel' },
  ]);
}

// ---------------------------------------------------------------------
// Rota do pedido: dois pontos numa mini-timeline vertical, cada um com
// cor/ícone próprios (loja = verde/loja, cliente = vermelho/bandeira),
// pra nunca dar pra confundir qual endereço é qual. `stage` diz qual dos
// dois é o passo atual (o outro fica esmaecido ou marcado como concluído).
// ---------------------------------------------------------------------
function RouteStops({
  restaurantAddress,
  clientAddress,
  stage,
  onNavigateRestaurant,
  onNavigateClient,
}: {
  restaurantAddress: string | null;
  clientAddress: string | null;
  stage: 'restaurant' | 'client';
  onNavigateRestaurant: () => void;
  onNavigateClient: () => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const restaurantDone = stage === 'client';

  return (
    <View style={styles.stopsWrap}>
      <View style={styles.stopRow}>
        <View style={styles.stopTimelineCol}>
          <View style={[styles.stopDot, { backgroundColor: colors.secondary }, restaurantDone && styles.stopDotDone]}>
            <Ionicons name={restaurantDone ? 'checkmark' : 'storefront'} size={12} color={colors.white} />
          </View>
          <View style={[styles.stopLine, restaurantDone && { backgroundColor: colors.secondary }]} />
        </View>
        <View style={[styles.stopContent, restaurantDone && { opacity: 0.5 }]}>
          <Text style={[styles.stopLabel, { color: colors.secondary }]}>RETIRAR NA LOJA</Text>
          <Text style={styles.stopAddress} numberOfLines={2}>
            {restaurantAddress || 'Endereço da loja não cadastrado'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.stopRouteBtn, { backgroundColor: colors.secondary }, restaurantDone && { opacity: 0.4 }]}
          onPress={onNavigateRestaurant}
        >
          <Ionicons name="navigate" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.stopRow}>
        <View style={styles.stopTimelineCol}>
          <View style={[styles.stopDot, { backgroundColor: colors.primary }, stage !== 'client' && styles.stopDotPending]}>
            <Ionicons name="flag" size={12} color={colors.white} />
          </View>
        </View>
        <View style={[styles.stopContent, stage !== 'client' && { opacity: 0.6 }]}>
          <Text style={[styles.stopLabel, { color: colors.primary }]}>ENTREGAR AO CLIENTE</Text>
          <Text style={styles.stopAddress} numberOfLines={2}>
            {clientAddress || 'Endereço do cliente não informado'}
          </Text>
        </View>
        <TouchableOpacity style={[styles.stopRouteBtn, { backgroundColor: colors.primary }]} onPress={onNavigateClient}>
          <Ionicons name="navigate" size={14} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function RestaurantAvatar({ uri, size = 44 }: { uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size * 0.28 }} contentFit="cover" cachePolicy="memory-disk" />;
  }
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Ionicons name="storefront" size={size * 0.45} color={colors.primary} />
    </View>
  );
}

// ---------------------------------------------------------------------
// Coluna de valores no cabeçalho do card: total do pedido (neutro, em
// cima) e o valor que o entregador ganha nessa corrida (destacado, com
// ícone de bicicleta, embaixo).
// ---------------------------------------------------------------------
function OrderValues({ total, deliveryFee }: { total: number; deliveryFee?: number }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.valuesCol}>
      <View style={styles.totalPill}>
        <Text style={styles.totalPillText}>R$ {Number(total).toFixed(2)}</Text>
      </View>
      <View style={styles.feePill}>
        <Ionicons name="bicycle" size={11} color={colors.primary} />
        <Text style={styles.feePillText}>+R$ {Number(deliveryFee || 0).toFixed(2)}</Text>
      </View>
    </View>
  );
}

export default function DelivererHomeScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { user, signOut } = useAuth();
  const [available, setAvailable] = useState(false);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  async function handleConfirmDelete(password: string) {
    await deleteAccount(password);
    await signOut();
  }

  const [radar, setRadar] = useState<RadarOrder[]>([]);
  const [loadingRadar, setLoadingRadar] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Suporta várias entregas ativas ao mesmo tempo.
  const [activeOrders, setActiveOrders] = useState<MyDeliveryOrder[]>([]);
  const [history, setHistory] = useState<MyDeliveryOrder[]>([]);

  // Estado de código por pedido (cada entrega ativa tem seu próprio input/estado).
  const [pickupCodes, setPickupCodes] = useState<Record<string, string>>({});
  const [deliveryCodes, setDeliveryCodes] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pickupConfirmedId, setPickupConfirmedId] = useState<string | null>(null);
  const checkScale = useRef(new Animated.Value(0)).current;

  const [chatOrder, setChatOrder] = useState<MyDeliveryOrder | null>(null);
  const [abandoningId, setAbandoningId] = useState<string | null>(null);

  // Vínculo com restaurante -- agora pode ser feito/desfeito a qualquer
  // momento pelo app, não só no cadastro.
  const [delivererProfile, setDelivererProfile] = useState<DelivererProfile | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await getDelivererProfile();
      setDelivererProfile(profile);
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function handleLinkRestaurant() {
    if (!inviteCodeInput.trim()) return;
    setLinking(true);
    try {
      await linkToRestaurant(inviteCodeInput);
      setInviteCodeInput('');
      await loadProfile();
      Alert.alert('Pronto!', 'Você agora está vinculado a esse restaurante.');
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Não foi possível vincular. Confira o código e tente de novo.';
      Alert.alert('Erro', message);
    } finally {
      setLinking(false);
    }
  }

  function handleUnlinkRestaurant() {
    Alert.alert(
      'Desvincular restaurante',
      'Você vai voltar a ser um entregador autônomo e sair do radar exclusivo desse restaurante. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            setUnlinking(true);
            try {
              await unlinkFromRestaurant();
              await loadProfile();
            } catch {
              Alert.alert('Erro', 'Não foi possível desvincular agora. Tente de novo.');
            } finally {
              setUnlinking(false);
            }
          },
        },
      ]
    );
  }

  const availableRef = useRef(available);
  availableRef.current = available;

  const loadMine = useCallback(async () => {
    try {
      const mine = await listMyDeliveries();
      const active = mine.filter((o) => o.status === 'procurando_entregador' || o.status === 'a_caminho');
      setActiveOrders(active);
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

      // Entregador da casa: o restaurante atribuiu esse pedido direto a
      // mim, sem passar pelo radar. Recarrega "minhas entregas" pra ele
      // aparecer na hora, com todos os campos já formatados certinho.
      s.on('order:assigned', () => {
        loadMine();
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

  // Devolve a corrida pro radar -- só funciona antes de retirar o pedido
  // na loja. Depois da retirada o pedido já está com o entregador, então
  // não dá mais pra outro assumir do ponto em que ele parou.
  function handleAbandonOrder(order: MyDeliveryOrder) {
    Alert.alert(
      'Devolver corrida?',
      'O pedido volta pro radar pra outro entregador aceitar. Só faça isso se você realmente não puder concluir essa entrega.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Devolver corrida',
          style: 'destructive',
          onPress: async () => {
            setAbandoningId(order.id);
            try {
              await abandonDelivery(order.id);
              await loadMine();
            } catch (err: any) {
              const message =
                err?.response?.data?.error || 'Não foi possível devolver essa corrida. Talvez você já tenha retirado o pedido.';
              Alert.alert('Não foi possível devolver', message);
              await loadMine();
            } finally {
              setAbandoningId(null);
            }
          },
        },
      ]
    );
  }

  async function handleConfirmPickup(order: MyDeliveryOrder) {
    const code = (pickupCodes[order.id] || '').trim();
    if (code.length !== 4) {
      Alert.alert('Código inválido', 'Peça ao restaurante o código de 4 dígitos da retirada.');
      return;
    }
    setConfirmingId(order.id);
    try {
      await confirmPickup(order.id, code);
      setPickupCodes((prev) => ({ ...prev, [order.id]: '' }));

      setPickupConfirmedId(order.id);
      checkScale.setValue(0);
      Animated.sequence([
        Animated.spring(checkScale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
      ]).start();

      setTimeout(async () => {
        setPickupConfirmedId(null);
        await loadMine();
        setConfirmingId(null);
      }, 1400);
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Código incorreto. Confira com o restaurante.';
      Alert.alert('Não foi possível confirmar', message);
      setConfirmingId(null);
    }
  }

  async function handleConfirmDelivery(order: MyDeliveryOrder) {
    const code = (deliveryCodes[order.id] || '').trim();
    if (code.length !== 4) {
      Alert.alert('Código inválido', 'Peça ao cliente o código de 4 dígitos da entrega.');
      return;
    }
    setConfirmingId(order.id);
    try {
      await confirmDelivery(order.id, code);
      setDeliveryCodes((prev) => ({ ...prev, [order.id]: '' }));
      await loadMine();
      await loadRadar();
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Código incorreto. Confira com o cliente.';
      Alert.alert('Não foi possível confirmar', message);
    } finally {
      setConfirmingId(null);
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

        <TouchableOpacity
          style={styles.deleteAccountLink}
          onPress={() => setDeleteModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
          <Text style={styles.deleteAccountLinkText}>Excluir minha conta</Text>
        </TouchableOpacity>

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
            disabled={togglingAvailability}
            trackColor={{ true: colors.secondary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.statusCard}>
          {delivererProfile?.tenantId ? (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>Vinculado a {delivererProfile.tenantName}</Text>
                <Text style={styles.statusSub}>Você recebe as corridas exclusivas desse restaurante</Text>
              </View>
              <TouchableOpacity onPress={handleUnlinkRestaurant} disabled={unlinking}>
                {unlinking ? (
                  <ActivityIndicator color={colors.danger} />
                ) : (
                  <Text style={{ color: colors.danger, fontWeight: '600' }}>Desvincular</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Entregador autônomo</Text>
              <Text style={styles.statusSub}>Tem o código de um restaurante? Vincule-se pra receber corridas exclusivas</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TextInput
                  value={inviteCodeInput}
                  onChangeText={setInviteCodeInput}
                  placeholder="Código do restaurante"
                  autoCapitalize="characters"
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                />
                <TouchableOpacity
                  onPress={handleLinkRestaurant}
                  disabled={linking || !inviteCodeInput.trim()}
                  style={{
                    backgroundColor: colors.primary,
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    justifyContent: 'center',
                    opacity: linking || !inviteCodeInput.trim() ? 0.6 : 1,
                  }}
                >
                  {linking ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={{ color: colors.white, fontWeight: '600' }}>Vincular</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
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

        {activeOrders.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Entregas em andamento {activeOrders.length > 1 ? `(${activeOrders.length})` : ''}
            </Text>

            {activeOrders.map((activeOrder) => {
              const stage: 'restaurant' | 'client' = activeOrder.status === 'procurando_entregador' ? 'restaurant' : 'client';
              const restaurantAddress = addressLine(restaurantDestination(activeOrder));
              const clientAddress = addressLine(clientDestination(activeOrder));

              return (
                <View key={activeOrder.id} style={[styles.card, { marginBottom: 14 }]}>
                  <View style={styles.cardHeaderRow}>
                    <RestaurantAvatar uri={activeOrder.restaurantImage} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardRestaurantName} numberOfLines={1}>{activeOrder.restaurantName}</Text>
                      <Text style={styles.cardOrderMeta}>Pedido #{activeOrder.id.slice(-5)}</Text>
                    </View>
                    <OrderValues total={activeOrder.total} deliveryFee={activeOrder.deliveryFee} />
                  </View>

                  <RouteStops
                    restaurantAddress={restaurantAddress}
                    clientAddress={clientAddress}
                    stage={stage}
                    onNavigateRestaurant={() => openNavigation(restaurantDestination(activeOrder))}
                    onNavigateClient={() => openNavigation(clientDestination(activeOrder))}
                  />

                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.chatBtn} onPress={() => setChatOrder(activeOrder)}>
                      <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.primary} />
                      <Text style={styles.chatBtnText}>Conversar</Text>
                    </TouchableOpacity>

                    {activeOrder.status === 'procurando_entregador' && (
                      <TouchableOpacity
                        style={[styles.abandonBtn, abandoningId === activeOrder.id && { opacity: 0.6 }]}
                        onPress={() => handleAbandonOrder(activeOrder)}
                        disabled={abandoningId === activeOrder.id}
                      >
                        {abandoningId === activeOrder.id ? (
                          <ActivityIndicator color={colors.danger} size="small" />
                        ) : (
                          <>
                            <Ionicons name="arrow-undo-outline" size={15} color={colors.danger} />
                            <Text style={styles.abandonBtnText}>Devolver corrida</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  {activeOrder.status === 'procurando_entregador' && (
                    <View style={styles.codeBox}>
                      {pickupConfirmedId === activeOrder.id ? (
                        <View style={styles.successBox}>
                          <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                            <Ionicons name="checkmark-circle" size={44} color={colors.secondary} />
                          </Animated.View>
                          <Text style={styles.successText}>Retirada confirmada!</Text>
                          <Text style={styles.successSub}>Agora siga até o cliente</Text>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.codeLabel}>Peça ao restaurante o código de retirada</Text>
                          <View style={styles.codeRow}>
                            <TextInput
                              style={styles.codeInput}
                              value={pickupCodes[activeOrder.id] || ''}
                              onChangeText={(text) => setPickupCodes((prev) => ({ ...prev, [activeOrder.id]: text }))}
                              placeholder="0000"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="number-pad"
                              maxLength={4}
                              editable={confirmingId !== activeOrder.id}
                            />
                            <TouchableOpacity
                              style={[styles.confirmBtn, confirmingId === activeOrder.id && { opacity: 0.6 }]}
                              onPress={() => handleConfirmPickup(activeOrder)}
                              disabled={confirmingId === activeOrder.id}
                            >
                              {confirmingId === activeOrder.id ? (
                                <ActivityIndicator color={colors.white} />
                              ) : (
                                <Text style={styles.confirmBtnText}>Confirmar retirada</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  )}

                  {activeOrder.status === 'a_caminho' && (
                    <View style={styles.codeBox}>
                      <Text style={styles.codeLabel}>Peça ao cliente o código de entrega</Text>
                      <View style={styles.codeRow}>
                        <TextInput
                          style={styles.codeInput}
                          value={deliveryCodes[activeOrder.id] || ''}
                          onChangeText={(text) => setDeliveryCodes((prev) => ({ ...prev, [activeOrder.id]: text }))}
                          placeholder="0000"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="number-pad"
                          maxLength={4}
                          editable={confirmingId !== activeOrder.id}
                        />
                        <TouchableOpacity
                          style={[styles.confirmBtn, confirmingId === activeOrder.id && { opacity: 0.6 }]}
                          onPress={() => handleConfirmDelivery(activeOrder)}
                          disabled={confirmingId === activeOrder.id}
                        >
                          {confirmingId === activeOrder.id ? (
                            <ActivityIndicator color={colors.white} />
                          ) : (
                            <Text style={styles.confirmBtnText}>Confirmar entrega</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

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
            radar.map((order) => {
              const restaurantAddress = addressLine(restaurantDestination(order));
              const clientAddress = addressLine(clientDestination(order));
              return (
                <View key={order.id} style={styles.card}>
                  <View style={styles.cardHeaderRow}>
                    <RestaurantAvatar uri={order.restaurantImage} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardRestaurantName} numberOfLines={1}>{order.restaurantName}</Text>
                      <Text style={styles.cardOrderMeta}>Pedido #{order.id.slice(-5)}</Text>
                    </View>
                    <OrderValues total={order.total} deliveryFee={order.deliveryFee} />
                  </View>

                  <RouteStops
                    restaurantAddress={restaurantAddress}
                    clientAddress={clientAddress}
                    stage="restaurant"
                    onNavigateRestaurant={() => openNavigation(restaurantDestination(order))}
                    onNavigateClient={() => openNavigation(clientDestination(order))}
                  />

                  <TouchableOpacity
                    style={[styles.acceptBtn, acceptingId === order.id && { opacity: 0.6 }]}
                    onPress={() => handleAcceptOrder(order)}
                    disabled={acceptingId === order.id}
                  >
                    {acceptingId === order.id ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.acceptBtnText}>Aceitar corrida</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {chatOrder && (
        <OrderChatModal
          visible={!!chatOrder}
          onClose={() => setChatOrder(null)}
          orderId={chatOrder.id}
          myRole="deliverer"
          title={chatOrder.restaurantName}
          loadMessages={getDelivererOrderMessages}
          sendMessage={sendDelivererOrderMessage}
        />
      )}

      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        onConfirm={handleConfirmDelete}
        consequences={[
          'Você sai do radar de corridas e perde o acesso à conta na hora.',
          'Seus dados pessoais serão apagados; o histórico de entregas fica preservado para o restaurante e o cliente.',
          'Não será possível desfazer essa ação depois de confirmada.',
        ]}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hello: { ...typography.h1, color: colors.text },
  sub: { color: colors.textMuted, marginTop: 2 },
  deleteAccountLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10, marginBottom: 4 },
  deleteAccountLinkText: { color: colors.textMuted, fontSize: 11.5, fontWeight: '600' },

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

  // Card de pedido (radar e entrega ativa compartilham o mesmo visual base)
  card: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatarPlaceholder: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  cardRestaurantName: { ...typography.bodyBold, color: colors.text, fontSize: 15 },
  cardOrderMeta: { color: colors.textMuted, fontSize: 11.5, marginTop: 1 },
  valuesCol: { alignItems: 'flex-end', gap: 6 },
  totalPill: { backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  totalPillText: { color: colors.text, fontWeight: '800', fontSize: 12.5 },
  feePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  feePillText: { color: colors.primary, fontWeight: '800', fontSize: 12 },

  // Mini-timeline com os dois pontos da rota (loja -> cliente), cada um
  // com cor e ícone próprios pra nunca dar pra confundir.
  stopsWrap: { backgroundColor: colors.background, borderRadius: 16, padding: 12, gap: 0 },
  stopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stopTimelineCol: { alignItems: 'center', width: 26 },
  stopDot: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
  },
  stopDotDone: { backgroundColor: colors.textMuted },
  stopDotPending: { opacity: 0.45 },
  stopLine: { width: 2, flex: 1, minHeight: 18, backgroundColor: colors.border, marginTop: 2 },
  stopContent: { flex: 1, paddingTop: 2, paddingBottom: 14 },
  stopLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  stopAddress: { color: colors.text, fontSize: 13, marginTop: 3, lineHeight: 17 },
  stopRouteBtn: {
    width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },

  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  chatBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primaryLight, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  chatBtnText: { color: colors.primary, fontSize: 12.5, fontWeight: '700' },
  abandonBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.danger, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  abandonBtnText: { color: colors.danger, fontSize: 12.5, fontWeight: '700' },

  acceptBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, marginTop: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  acceptBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  successBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 4 },
  successText: { ...typography.bodyBold, color: colors.text, fontSize: 15, marginTop: 6 },
  successSub: { color: colors.textMuted, fontSize: 12.5 },

  codeBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
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
};