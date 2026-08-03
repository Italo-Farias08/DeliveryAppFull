import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
  MenuItemInput,
  RestaurantInput,
  TenantOrder,
  createMenuItem,
  createRestaurant,
  deleteMenuItem,
  getCategories,
  listMenuItems,
  listMyRestaurants,
  listTenantOrders,
  updateMenuItem,
  updateOrderStatus,
  updateRestaurant,
} from '../../services/tenantService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Category, MenuItem, OrderStatus, Restaurant } from '../../types';

const statusFlow: Record<OrderStatus, OrderStatus | null> = {
  preparando: 'a caminho',
  'a caminho': 'entregue',
  entregue: null,
  cancelado: null,
};

const statusLabel: Record<OrderStatus, string> = {
  preparando: 'Preparando',
  'a caminho': 'A caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

function todayKey(iso: string) {
  return new Date(iso).toDateString();
}

export default function RestaurantHomeScreen() {
  const { user, signOut } = useAuth();

  const [loadingInit, setLoadingInit] = useState(true);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<TenantOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [savingStatus, setSavingStatus] = useState(false);

  // form para criar o restaurante (onboarding)
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [obName, setObName] = useState('');
  const [obCategoryId, setObCategoryId] = useState<string | null>(null);
  const [obFee, setObFee] = useState('');
  const [obMin, setObMin] = useState('25');
  const [obMax, setObMax] = useState('40');

  // modal de item do cardápio
  const [menuModalVisible, setMenuModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [miName, setMiName] = useState('');
  const [miDescription, setMiDescription] = useState('');
  const [miPrice, setMiPrice] = useState('');
  const [miImage, setMiImage] = useState('');

  const loadEverything = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoadingInit(true);
    try {
      const [cats, myRestaurants] = await Promise.all([getCategories(), listMyRestaurants()]);
      setCategories(cats);
      const current = myRestaurants[0] || null;
      setRestaurant(current);
      if (current) {
        const [items, tenantOrders] = await Promise.all([
          listMenuItems(current.id),
          listTenantOrders(),
        ]);
        setMenuItems(items);
        setOrders(tenantOrders);
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar os dados do painel.');
    } finally {
      isRefresh ? setRefreshing(false) : setLoadingInit(false);
    }
  }, []);

  useEffect(() => {
    loadEverything();
  }, [loadEverything]);

  async function handleCreateRestaurant() {
    if (!obName.trim() || !obCategoryId) {
      Alert.alert('Preencha os campos', 'Nome e categoria são obrigatórios.');
      return;
    }
    const fee = Number(obFee.replace(',', '.'));
    const min = parseInt(obMin, 10);
    const max = parseInt(obMax, 10);
    if (Number.isNaN(fee) || fee < 0) {
      Alert.alert('Taxa inválida', 'Informe uma taxa de entrega válida.');
      return;
    }
    if (!min || !max || min <= 0 || max <= 0) {
      Alert.alert('Tempo inválido', 'Informe o tempo mínimo e máximo de entrega.');
      return;
    }
    const payload: RestaurantInput = {
      name: obName.trim(),
      categoryId: obCategoryId,
      deliveryFee: fee,
      deliveryTimeMin: min,
      deliveryTimeMax: max,
      isOpen: true,
    };
    setOnboardingSaving(true);
    try {
      const created = await createRestaurant(payload);
      setRestaurant(created);
    } catch (err: any) {
      Alert.alert('Erro ao criar restaurante', err?.response?.data?.error || 'Tente novamente.');
    } finally {
      setOnboardingSaving(false);
    }
  }

  async function handleToggleOpen(value: boolean) {
    if (!restaurant) return;
    setSavingStatus(true);
    const previous = restaurant.isOpen;
    setRestaurant({ ...restaurant, isOpen: value });
    try {
      const payload: RestaurantInput = {
        name: restaurant.name,
        categoryId: restaurant.categoryId,
        deliveryFee: restaurant.deliveryFee,
        deliveryTimeMin: restaurant.deliveryTimeMin,
        deliveryTimeMax: restaurant.deliveryTimeMax,
        isOpen: value,
      };
      const updated = await updateRestaurant(restaurant.id, payload);
      setRestaurant(updated);
    } catch (err) {
      setRestaurant((r) => (r ? { ...r, isOpen: previous } : r));
      Alert.alert('Erro', 'Não foi possível atualizar o status da loja.');
    } finally {
      setSavingStatus(false);
    }
  }

  function openCreateMenuModal() {
    setEditingItem(null);
    setMiName('');
    setMiDescription('');
    setMiPrice('');
    setMiImage('');
    setMenuModalVisible(true);
  }

  function openEditMenuModal(item: MenuItem) {
    setEditingItem(item);
    setMiName(item.name);
    setMiDescription(item.description || '');
    setMiPrice(String(item.price));
    setMiImage(item.image || '');
    setMenuModalVisible(true);
  }

  async function handleSaveMenuItem() {
    if (!restaurant) return;
    if (!miName.trim()) {
      Alert.alert('Preencha o nome', 'O item precisa de um nome.');
      return;
    }
    const price = Number(miPrice.replace(',', '.'));
    if (Number.isNaN(price) || price <= 0) {
      Alert.alert('Preço inválido', 'Informe um preço válido para o item.');
      return;
    }
    const payload: MenuItemInput = {
      name: miName.trim(),
      description: miDescription.trim() || undefined,
      price,
      image: miImage.trim() || undefined,
      isAvailable: true,
    };
    setSavingItem(true);
    try {
      if (editingItem) {
        const updated = await updateMenuItem(editingItem.id, payload);
        setMenuItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        const created = await createMenuItem(restaurant.id, payload);
        setMenuItems((prev) => [created, ...prev]);
      }
      setMenuModalVisible(false);
    } catch (err: any) {
      Alert.alert('Erro ao salvar item', err?.response?.data?.error || 'Tente novamente.');
    } finally {
      setSavingItem(false);
    }
  }

  function handleDeleteMenuItem(item: MenuItem) {
    Alert.alert('Remover item', `Remover "${item.name}" do cardápio?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMenuItem(item.id);
            setMenuItems((prev) => prev.filter((m) => m.id !== item.id));
          } catch {
            Alert.alert('Erro', 'Não foi possível remover o item.');
          }
        },
      },
    ]);
  }

  async function handleAdvanceOrder(order: TenantOrder) {
    const next = statusFlow[order.status];
    if (!next) return;
    try {
      await updateOrderStatus(order.id, next);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: next } : o)));
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o status do pedido.');
    }
  }

  const todayStr = new Date().toDateString();
  const ordersToday = orders.filter((o) => todayKey(o.createdAt) === todayStr);
  const revenueToday = ordersToday
    .filter((o) => o.status !== 'cancelado')
    .reduce((sum, o) => sum + Number(o.total), 0);

  if (loadingInit) {
    return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!restaurant) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.hello}>Olá, {user?.name}</Text>
              <Text style={styles.sub}>Vamos criar seu restaurante</Text>
            </View>
            <TouchableOpacity onPress={signOut}>
              <Ionicons name="log-out-outline" size={24} color={colors.danger} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dados do restaurante</Text>
            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={obName} onChangeText={setObName} placeholder="Ex: Brasa & Cia" />

            <Text style={styles.label}>Categoria</Text>
            <View style={styles.pillsWrap}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setObCategoryId(c.id)}
                  style={[styles.pill, obCategoryId === c.id && styles.pillActive]}
                >
                  <Text style={[styles.pillText, obCategoryId === c.id && styles.pillTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Taxa de entrega (R$)</Text>
            <TextInput
              style={styles.input}
              value={obFee}
              onChangeText={setObFee}
              placeholder="Ex: 6.90"
              keyboardType="decimal-pad"
            />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Tempo mín. (min)</Text>
                <TextInput style={styles.input} value={obMin} onChangeText={setObMin} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Tempo máx. (min)</Text>
                <TextInput style={styles.input} value={obMax} onChangeText={setObMax} keyboardType="number-pad" />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, onboardingSaving && { opacity: 0.6 }]}
              onPress={handleCreateRestaurant}
              disabled={onboardingSaving}
            >
              {onboardingSaving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryBtnText}>Criar restaurante</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadEverything(true)} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.hello}>Olá, {user?.name}</Text>
            <Text style={styles.sub}>{restaurant.name}</Text>
          </View>
          <TouchableOpacity onPress={signOut}>
            <Ionicons name="log-out-outline" size={24} color={colors.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusTitle}>{restaurant.isOpen ? 'Loja aberta' : 'Loja fechada'}</Text>
            <Text style={styles.statusSub}>
              {restaurant.isOpen ? 'Você está recebendo pedidos' : 'Clientes não podem pedir agora'}
            </Text>
          </View>
          <Switch
            value={restaurant.isOpen}
            onValueChange={handleToggleOpen}
            disabled={savingStatus}
            trackColor={{ true: colors.secondary, false: colors.border }}
            thumbColor={colors.white}
          />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="receipt-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{ordersToday.length}</Text>
            <Text style={styles.statLabel}>Pedidos hoje</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={20} color={colors.secondary} />
            <Text style={styles.statValue}>R$ {revenueToday.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Faturamento hoje</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pedidos recentes</Text>
          {orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="fast-food-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum pedido ainda</Text>
              <Text style={styles.emptySub}>Os pedidos dos clientes vão aparecer aqui</Text>
            </View>
          ) : (
            orders.slice(0, 10).map((order) => (
              <View key={order.id} style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderId}>Pedido #{order.id.slice(-5)}</Text>
                  <Text style={styles.orderTotal}>R$ {Number(order.total).toFixed(2)} · {statusLabel[order.status]}</Text>
                </View>
                {statusFlow[order.status] && (
                  <TouchableOpacity style={styles.advanceBtn} onPress={() => handleAdvanceOrder(order)}>
                    <Text style={styles.advanceBtnText}>Marcar {statusLabel[statusFlow[order.status]!]}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Cardápio</Text>
          </View>

          <TouchableOpacity style={styles.menuBtn} activeOpacity={0.8} onPress={openCreateMenuModal}>
            <Ionicons name="add-circle-outline" size={20} color={colors.secondary} />
            <Text style={styles.menuBtnText}>Adicionar item ao cardápio</Text>
          </TouchableOpacity>

          {menuItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="restaurant-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nenhum item cadastrado</Text>
              <Text style={styles.emptySub}>Adicione o primeiro item do seu cardápio</Text>
            </View>
          ) : (
            menuItems.map((item) => (
              <View key={item.id} style={styles.menuItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemPrice}>R$ {Number(item.price).toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={() => openEditMenuModal(item)}>
                  <Ionicons name="pencil-outline" size={18} color={colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteMenuItem(item)}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={menuModalVisible} animationType="slide" transparent onRequestClose={() => setMenuModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editingItem ? 'Editar item' : 'Novo item do cardápio'}</Text>

            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={miName} onChangeText={setMiName} placeholder="Ex: Cheeseburger Duplo" />

            <Text style={styles.label}>Descrição (opcional)</Text>
            <TextInput style={styles.input} value={miDescription} onChangeText={setMiDescription} placeholder="Ex: Dois blends, queijo cheddar" />

            <Text style={styles.label}>Preço (R$)</Text>
            <TextInput style={styles.input} value={miPrice} onChangeText={setMiPrice} placeholder="Ex: 28.90" keyboardType="decimal-pad" />

            <Text style={styles.label}>Imagem — URL (opcional)</Text>
            <TextInput style={styles.input} value={miImage} onChangeText={setMiImage} placeholder="https://..." autoCapitalize="none" />

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={styles.outlineBtn} onPress={() => setMenuModalVisible(false)}>
                <Text style={styles.outlineBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }, savingItem && { opacity: 0.6 }]}
                onPress={handleSaveMenuItem}
                disabled={savingItem}
              >
                {savingItem ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  menuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.secondaryLight, borderRadius: 14, padding: 16, marginBottom: 12,
  },
  menuBtnText: { color: colors.secondary, fontWeight: '700' },
  orderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  orderId: { ...typography.bodyBold, color: colors.text },
  orderTotal: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  advanceBtn: { backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  advanceBtnText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  menuItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  menuItemName: { ...typography.bodyBold, color: colors.text },
  menuItemPrice: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.surface,
  },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  pillActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  pillText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.white },
  primaryBtn: {
    marginTop: 20, backgroundColor: colors.primary, borderRadius: 14, height: 50,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  outlineBtn: {
    flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  outlineBtnText: { color: colors.text, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32,
  },
  modalTitle: { ...typography.h2, color: colors.text },
});
