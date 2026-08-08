import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
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
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import OrderChatModal from '../../components/OrderChatModal';
import {
  AddonInput,
  MenuCategoryInput,
  MenuItemInput,
  PickedImage,
  RestaurantInput,
  TenantOrder,
  acceptOrder,
  createAddon,
  createMenuCategory,
  createMenuItem,
  createRestaurant,
  deleteAddon,
  deleteMenuCategory,
  deleteMenuItem,
  getCategories,
  getTenantOrderMessages,
  listAddons,
  listMenuCategories,
  listMenuItems,
  listMyRestaurants,
  listTenantOrders,
  markOrderReady,
  rejectOrder,
  sendTenantOrderMessage,
  updateAddon,
  updateMenuItem,
  updateRestaurant,
  uploadMenuItemImage,
  uploadRestaurantBanner,
  uploadRestaurantLogo,
} from '../../services/tenantService';
import { connectSocket, disconnectSocket } from '../../services/socket';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Addon, Category, MenuCategory, MenuItem, OrderStatus, Restaurant } from '../../types';

const statusLabel: Record<OrderStatus, string> = {
  pendente: 'Novo pedido',
  preparando: 'Preparando',
  procurando_entregador: 'Buscando entregador',
  a_caminho: 'A caminho',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

const statusColor: Record<OrderStatus, string> = {
  pendente: colors.primary,
  preparando: colors.star,
  procurando_entregador: colors.secondary,
  a_caminho: colors.secondary,
  entregue: colors.textMuted,
  cancelado: colors.danger,
};

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

function todayKey(iso: string) {
  return new Date(iso).toDateString();
}

// ---------------------------------------------------------------------------
// Ponto pulsante ao lado de "Loja aberta/fechada" — dá a sensação de status
// "ao vivo" no card de destaque, sem exagerar na animação.
// ---------------------------------------------------------------------------
function PulseDot({ color, active }: { color: string; active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.9, duration: 1000, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        Animated.delay(500),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <View style={styles.pulseDotWrap}>
      {active && (
        <Animated.View
          style={[
            styles.pulseDotRing,
            {
              backgroundColor: color,
              transform: [{ scale }],
              opacity: scale.interpolate({ inputRange: [1, 1.9], outputRange: [0.55, 0] }),
            },
          ]}
        />
      )}
      <View style={[styles.pulseDotCore, { backgroundColor: color }]} />
    </View>
  );
}

export default function RestaurantHomeScreen() {
  const { user, signOut } = useAuth();

  const [loadingInit, setLoadingInit] = useState(true);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<TenantOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // categorias do cardápio (Pizzas, Carnes, Hambúrgueres...) e qual delas
  // está selecionada pra filtrar a lista de itens aqui embaixo
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [activeMenuCategoryId, setActiveMenuCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const [savingStatus, setSavingStatus] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [chatOrder, setChatOrder] = useState<TenantOrder | null>(null);

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
  // Foto do item: enquanto o item ainda não existe (criação), guardamos só a
  // URI local escolhida (miPickedImage) e mandamos pro servidor depois que o
  // item for criado. Em edição, o envio já acontece na hora que a foto é
  // escolhida, então miPickedImage fica sempre null nesse caso.
  const [miPickedImage, setMiPickedImage] = useState<PickedImage | null>(null);
  const [miImagePreview, setMiImagePreview] = useState<string | null>(null);
  const [miUploadingImage, setMiUploadingImage] = useState(false);
  const [miCategoryId, setMiCategoryId] = useState<string | null>(null);

  // adicionais do item que está sendo editado (ex: bacon extra, borda
  // recheada) — só existe pra item que já foi salvo (tem id)
  const [itemAddons, setItemAddons] = useState<Addon[]>([]);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [savingAddon, setSavingAddon] = useState(false);

  const loadEverything = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoadingInit(true);
    try {
      const [cats, myRestaurants] = await Promise.all([getCategories(), listMyRestaurants()]);
      setCategories(cats);
      const current = myRestaurants[0] || null;
      setRestaurant(current);
      if (current) {
        const [items, tenantOrders, menuCats] = await Promise.all([
          listMenuItems(current.id),
          listTenantOrders(),
          listMenuCategories(current.id),
        ]);
        setMenuItems(items);
        setOrders(tenantOrders);
        setMenuCategories(menuCats);
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

  // Novos pedidos chegam em tempo real: o cliente finaliza a compra e o
  // restaurante já vê aqui na hora, sem precisar dar refresh.
  useEffect(() => {
    connectSocket().then((s) => {
      if (!s) return;
      s.on('order:new', (order: TenantOrder) => {
        setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev : [order, ...prev]));
      });
      s.on('order:courierAssigned', ({ id }: { id: string }) => {
        loadEverything(true);
      });
      // Cliente cancelou um pedido que ainda estava pendente -- atualiza o
      // status na hora, senão o restaurante pode tentar aceitar um pedido
      // que o cliente já desistiu.
      s.on('order:cancelled', ({ id, status, cancelReason }: { id: string; status: OrderStatus; cancelReason?: string }) => {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status, cancelReason } : o)));
      });
    });
    return () => {
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Abre a galeria do celular e devolve a imagem escolhida (ou null se
  // cancelou/sem permissão). Usada pela logo, pelo banner e pela foto do item.
  async function pickImageFromLibrary(aspect: [number, number]): Promise<PickedImage | null> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Precisamos acessar suas fotos para você escolher a imagem.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return null;
    const asset = result.assets[0];
    return { uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType };
  }

  async function handlePickRestaurantLogo() {
    if (!restaurant) return;
    const picked = await pickImageFromLibrary([1, 1]);
    if (!picked) return;
    setUploadingLogo(true);
    try {
      const updated = await uploadRestaurantLogo(restaurant.id, picked);
      setRestaurant(updated);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível enviar a logo. Tente novamente.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handlePickRestaurantBanner() {
    if (!restaurant) return;
    const picked = await pickImageFromLibrary([16, 9]);
    if (!picked) return;
    setUploadingBanner(true);
    try {
      const updated = await uploadRestaurantBanner(restaurant.id, picked);
      setRestaurant(updated);
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível enviar o banner. Tente novamente.');
    } finally {
      setUploadingBanner(false);
    }
  }

  async function handlePickMenuItemImage() {
    const picked = await pickImageFromLibrary([4, 3]);
    if (!picked) return;

    if (editingItem) {
      // O item já existe no servidor: manda a foto na hora.
      setMiUploadingImage(true);
      try {
        const updated = await uploadMenuItemImage(editingItem.id, picked);
        setMenuItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        setEditingItem(updated);
        setMiImagePreview(updated.image);
      } catch (err) {
        Alert.alert('Erro', 'Não foi possível enviar a foto do item.');
      } finally {
        setMiUploadingImage(false);
      }
    } else {
      // Item novo ainda não existe: guarda a foto escolhida e só envia
      // depois que o item for criado (ver handleSaveMenuItem).
      setMiPickedImage(picked);
      setMiImagePreview(picked.uri);
    }
  }

  function resetAddonForm() {
    setAddonName('');
    setAddonPrice('');
    setEditingAddonId(null);
  }

  function openCreateMenuModal() {
    setEditingItem(null);
    setMiName('');
    setMiDescription('');
    setMiPrice('');
    setMiPickedImage(null);
    setMiImagePreview(null);
    // se o dono já estava filtrando por uma categoria, o novo item já nasce nela
    setMiCategoryId(activeMenuCategoryId);
    setItemAddons([]);
    resetAddonForm();
    setMenuModalVisible(true);
  }

  function openEditMenuModal(item: MenuItem) {
    setEditingItem(item);
    setMiName(item.name);
    setMiDescription(item.description || '');
    setMiPrice(String(item.price));
    setMiPickedImage(null);
    setMiImagePreview(item.image || null);
    setMiCategoryId(item.categoryId || null);
    resetAddonForm();
    setMenuModalVisible(true);
    setLoadingAddons(true);
    listAddons(item.id)
      .then(setItemAddons)
      .catch(() => setItemAddons([]))
      .finally(() => setLoadingAddons(false));
  }

  function startEditAddon(addon: Addon) {
    setEditingAddonId(addon.id);
    setAddonName(addon.name);
    setAddonPrice(String(addon.price));
  }

  async function handleSaveAddon() {
    if (!editingItem) return;
    const name = addonName.trim();
    if (!name) {
      Alert.alert('Preencha o nome', 'O adicional precisa de um nome.');
      return;
    }
    const price = Number(addonPrice.replace(',', '.'));
    if (Number.isNaN(price) || price < 0) {
      Alert.alert('Preço inválido', 'Informe um preço válido (pode ser 0).');
      return;
    }
    const payload: AddonInput = { name, price };
    setSavingAddon(true);
    try {
      if (editingAddonId) {
        const updated = await updateAddon(editingAddonId, payload);
        setItemAddons((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      } else {
        const created = await createAddon(editingItem.id, payload);
        setItemAddons((prev) => [...prev, created]);
      }
      resetAddonForm();
    } catch (err: any) {
      Alert.alert('Erro ao salvar adicional', err?.response?.data?.error || 'Tente novamente.');
    } finally {
      setSavingAddon(false);
    }
  }

  function handleDeleteAddon(addon: Addon) {
    Alert.alert('Remover adicional', `Remover "${addon.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAddon(addon.id);
            setItemAddons((prev) => prev.filter((a) => a.id !== addon.id));
            if (editingAddonId === addon.id) resetAddonForm();
          } catch {
            Alert.alert('Erro', 'Não foi possível remover o adicional.');
          }
        },
      },
    ]);
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
      isAvailable: true,
      categoryId: miCategoryId,
    };
    setSavingItem(true);
    try {
      if (editingItem) {
        const updated = await updateMenuItem(editingItem.id, payload);
        setMenuItems((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      } else {
        let created = await createMenuItem(restaurant.id, payload);
        if (miPickedImage) {
          try {
            created = await uploadMenuItemImage(created.id, miPickedImage);
          } catch (err) {
            Alert.alert('Item criado', 'O item foi salvo, mas a foto não pôde ser enviada. Edite o item para tentar de novo.');
          }
        }
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

  async function handleCreateMenuCategory() {
    if (!restaurant) return;
    const name = newCategoryName.trim();
    if (!name) return;
    const payload: MenuCategoryInput = { name, sortOrder: menuCategories.length };
    setSavingCategory(true);
    try {
      const created = await createMenuCategory(restaurant.id, payload);
      setMenuCategories((prev) => [...prev, created]);
      setNewCategoryName('');
    } catch (err: any) {
      Alert.alert('Erro ao criar categoria', err?.response?.data?.error || 'Tente novamente.');
    } finally {
      setSavingCategory(false);
    }
  }

  function handleDeleteMenuCategory(category: MenuCategory) {
    Alert.alert(
      'Remover categoria',
      `Remover "${category.name}"? Os itens dela continuam no cardápio, só ficam sem categoria.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMenuCategory(category.id);
              setMenuCategories((prev) => prev.filter((c) => c.id !== category.id));
              setMenuItems((prev) =>
                prev.map((m) => (m.categoryId === category.id ? { ...m, categoryId: null } : m))
              );
              if (activeMenuCategoryId === category.id) setActiveMenuCategoryId(null);
            } catch {
              Alert.alert('Erro', 'Não foi possível remover a categoria.');
            }
          },
        },
      ]
    );
  }

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

  async function handleMarkReady(order: TenantOrder) {
    setSavingOrderId(order.id);
    try {
      await markOrderReady(order.id);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'procurando_entregador' } : o)));
    } catch {
      Alert.alert('Erro', 'Não foi possível marcar o pedido como pronto.');
    } finally {
      setSavingOrderId(null);
    }
  }

  const filteredMenuItems = activeMenuCategoryId
    ? menuItems.filter((item) => item.categoryId === activeMenuCategoryId)
    : menuItems;

  const todayStr = new Date().toDateString();
  const ordersToday = orders.filter((o) => todayKey(o.createdAt) === todayStr);
  const revenueToday = ordersToday
    .filter((o) => o.status !== 'cancelado')
    .reduce((sum, o) => sum + Number(o.total), 0);
  const pendingCount = orders.filter((o) => o.status === 'pendente').length;

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
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>PAINEL DO RESTAURANTE</Text>
              <Text style={styles.hello}>Olá, {user?.name}</Text>
              <Text style={styles.sub}>Vamos criar seu restaurante</Text>
            </View>
            <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconCircle}>
                <Ionicons name="storefront-outline" size={16} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Dados do restaurante</Text>
            </View>

            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={obName} onChangeText={setObName} placeholder="Ex: Brasa & Cia" placeholderTextColor={colors.textMuted} />

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
              placeholderTextColor={colors.textMuted}
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
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadEverything(true)} tintColor={colors.primary} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>PAINEL DO RESTAURANTE</Text>
            <Text style={styles.hello}>{restaurant.name}</Text>
            <Text style={styles.sub}>Olá, {user?.name} 👋</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Card de destaque — status da loja "ao vivo" + números do dia, tudo
            num único bloco forte (o resto da tela fica deliberadamente mais
            neutro em volta dele). */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>STATUS DA LOJA</Text>
              <View style={styles.heroStatusRow}>
                <PulseDot color={restaurant.isOpen ? colors.secondary : 'rgba(255,255,255,0.55)'} active={restaurant.isOpen} />
                <Text style={styles.heroStatusTitle}>{restaurant.isOpen ? 'Aberta agora' : 'Fechada'}</Text>
              </View>
              <Text style={styles.heroStatusSub}>
                {restaurant.isOpen ? 'Você está recebendo pedidos' : 'Clientes não podem pedir agora'}
              </Text>
            </View>
            <Switch
              value={restaurant.isOpen}
              onValueChange={handleToggleOpen}
              disabled={savingStatus}
              trackColor={{ true: 'rgba(255,255,255,0.55)', false: 'rgba(255,255,255,0.25)' }}
              thumbColor={colors.white}
              ios_backgroundColor="rgba(255,255,255,0.25)"
            />
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatIconWrap}>
                <Ionicons name="receipt-outline" size={16} color={colors.white} />
              </View>
              <View>
                <Text style={styles.heroStatValue}>{ordersToday.length}</Text>
                <Text style={styles.heroStatLabel}>Pedidos hoje</Text>
              </View>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStatItem}>
              <View style={styles.heroStatIconWrap}>
                <Ionicons name="cash-outline" size={16} color={colors.white} />
              </View>
              <View>
                <Text style={styles.heroStatValue}>R$ {revenueToday.toFixed(2)}</Text>
                <Text style={styles.heroStatLabel}>Faturamento hoje</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="images-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Fotos da loja</Text>
          </View>
          <View style={styles.photosRow}>
            <TouchableOpacity style={styles.logoPicker} onPress={handlePickRestaurantLogo} activeOpacity={0.85}>
              {restaurant.image ? (
                <Image source={{ uri: restaurant.image }} style={styles.logoImage} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.logoImage, styles.imagePlaceholder]}>
                  <Ionicons name="storefront-outline" size={22} color={colors.textMuted} />
                </View>
              )}
              <View style={styles.editBadge}>
                {uploadingLogo ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={12} color={colors.white} />
                )}
              </View>
              <Text style={styles.photoCaption}>Logo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.bannerPicker} onPress={handlePickRestaurantBanner} activeOpacity={0.85}>
              {restaurant.banner ? (
                <Image source={{ uri: restaurant.banner }} style={styles.bannerImage} contentFit="cover" cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.bannerImage, styles.imagePlaceholder]}>
                  <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                  <Text style={styles.imagePlaceholderText}>Banner da loja</Text>
                </View>
              )}
              <View style={styles.editBadge}>
                {uploadingBanner ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="camera" size={12} color={colors.white} />
                )}
              </View>
              <Text style={styles.photoCaption}>Banner</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>
            A logo aparece nos cards da sua loja. O banner é a foto de capa que o cliente vê ao abrir seu restaurante.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="receipt-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { marginBottom: 0, flex: 1 }]}>Pedidos recentes</Text>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount} novo{pendingCount > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>

          {orders.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="fast-food-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>Nenhum pedido ainda</Text>
              <Text style={styles.emptySub}>Os pedidos dos clientes vão aparecer aqui</Text>
            </View>
          ) : (
            orders.slice(0, 15).map((order) => {
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
                <View key={order.id} style={styles.orderCard}>
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
                        <TouchableOpacity onPress={() => Linking.openURL(mapsUrl)} style={styles.mapLinkRow}>
                          <Ionicons name="location-outline" size={13} color={colors.secondary} />
                          <Text style={styles.mapLinkText}>Ver localização no mapa</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity style={styles.chatBtn} onPress={() => setChatOrder(order)}>
                      <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {(order.items ?? []).length > 0 && (
                    <View style={styles.orderItemsBox}>
                      <Text style={styles.orderItemsText}>
                        {order.items.map((it) => `${it.qty}x ${it.name}`).join(', ')}
                      </Text>
                    </View>
                  )}

                  {order.status === 'pendente' && (
                    <View style={styles.orderActionsRow}>
                      <TouchableOpacity
                        style={[styles.outlineSmallBtn, saving && { opacity: 0.6 }]}
                        onPress={() => handleRejectOrder(order)}
                        disabled={saving}
                      >
                        <Text style={styles.outlineSmallBtnText}>Recusar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.advanceBtn, { flex: 1 }, saving && { opacity: 0.6 }]}
                        onPress={() => handleAcceptOrder(order)}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator color={colors.white} />
                        ) : (
                          <Text style={styles.advanceBtnText}>Aceitar pedido</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}

                  {order.status === 'preparando' && (
                    <TouchableOpacity
                      style={[styles.advanceBtn, styles.advanceBtnFull, saving && { opacity: 0.6 }]}
                      onPress={() => handleMarkReady(order)}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color={colors.white} />
                      ) : (
                        <Text style={styles.advanceBtnText}>Pedido pronto — chamar entregador</Text>
                      )}
                    </TouchableOpacity>
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
                </View>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconCircle}>
              <Ionicons name="restaurant-outline" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.sectionTitle, { marginBottom: 0, flex: 1 }]}>Cardápio</Text>
            <Text style={styles.sectionCount}>{menuItems.length} {menuItems.length === 1 ? 'item' : 'itens'}</Text>
          </View>

          <Text style={styles.label}>Categorias do cardápio</Text>
          <Text style={styles.helperText}>
            Crie categorias como Pizzas, Carnes ou Hambúrgueres. Elas aparecem como filtros para o
            cliente e ajudam a organizar seus itens.
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
          >
            <TouchableOpacity
              style={[styles.pill, !activeMenuCategoryId && styles.pillActive]}
              onPress={() => setActiveMenuCategoryId(null)}
            >
              <Text style={[styles.pillText, !activeMenuCategoryId && styles.pillTextActive]}>Todos</Text>
            </TouchableOpacity>
            {menuCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.pill, styles.pillWithAction, activeMenuCategoryId === cat.id && styles.pillActive]}
                onPress={() => setActiveMenuCategoryId(cat.id)}
                onLongPress={() => handleDeleteMenuCategory(cat)}
              >
                <Text style={[styles.pillText, activeMenuCategoryId === cat.id && styles.pillTextActive]}>
                  {cat.name}
                </Text>
                <TouchableOpacity hitSlop={8} onPress={() => handleDeleteMenuCategory(cat)}>
                  <Ionicons
                    name="close-circle"
                    size={15}
                    color={activeMenuCategoryId === cat.id ? colors.white : colors.textMuted}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.addCategoryRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              placeholder="Nova categoria, ex: Pizzas"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={handleCreateMenuCategory}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addCategoryBtn, savingCategory && { opacity: 0.6 }]}
              onPress={handleCreateMenuCategory}
              disabled={savingCategory}
            >
              {savingCategory ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Ionicons name="add" size={20} color={colors.white} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.menuBtn, { marginTop: 18 }]} activeOpacity={0.8} onPress={openCreateMenuModal}>
            <Ionicons name="add-circle-outline" size={20} color={colors.secondary} />
            <Text style={styles.menuBtnText}>Adicionar item ao cardápio</Text>
          </TouchableOpacity>

          {filteredMenuItems.length === 0 ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="restaurant-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyText}>Nenhum item cadastrado</Text>
              <Text style={styles.emptySub}>
                {activeMenuCategoryId ? 'Nenhum item nesta categoria ainda' : 'Adicione o primeiro item do seu cardápio'}
              </Text>
            </View>
          ) : (
            filteredMenuItems.map((item) => {
              const itemCategory = menuCategories.find((c) => c.id === item.categoryId);
              return (
                <View key={item.id} style={styles.menuItemRow}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.menuItemThumb} contentFit="cover" cachePolicy="memory-disk" />
                  ) : (
                    <View style={[styles.menuItemThumb, styles.imagePlaceholder]}>
                      <Ionicons name="restaurant-outline" size={16} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.menuItemName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.menuItemMetaRow}>
                      <Text style={styles.menuItemPrice}>R$ {Number(item.price).toFixed(2)}</Text>
                      {itemCategory && (
                        <View style={styles.menuItemCategoryTag}>
                          <Text style={styles.menuItemCategoryTagText}>{itemCategory.name}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.menuItemActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEditMenuModal(item)}>
                      <Ionicons name="pencil-outline" size={16} color={colors.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteMenuItem(item)}>
                      <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={menuModalVisible} animationType="slide" transparent onRequestClose={() => setMenuModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{editingItem ? 'Editar item' : 'Novo item do cardápio'}</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setMenuModalVisible(false)}>
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Nome</Text>
              <TextInput style={styles.input} value={miName} onChangeText={setMiName} placeholder="Ex: Cheeseburger Duplo" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Descrição (opcional)</Text>
              <TextInput style={styles.input} value={miDescription} onChangeText={setMiDescription} placeholder="Ex: Dois blends, queijo cheddar" placeholderTextColor={colors.textMuted} />

              <Text style={styles.label}>Preço (R$)</Text>
              <TextInput style={styles.input} value={miPrice} onChangeText={setMiPrice} placeholder="Ex: 28.90" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />

              {menuCategories.length > 0 && (
                <>
                  <Text style={styles.label}>Categoria</Text>
                  <View style={styles.pillsWrap}>
                    <TouchableOpacity
                      style={[styles.pill, !miCategoryId && styles.pillActive]}
                      onPress={() => setMiCategoryId(null)}
                    >
                      <Text style={[styles.pillText, !miCategoryId && styles.pillTextActive]}>Sem categoria</Text>
                    </TouchableOpacity>
                    {menuCategories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.pill, miCategoryId === cat.id && styles.pillActive]}
                        onPress={() => setMiCategoryId(cat.id)}
                      >
                        <Text style={[styles.pillText, miCategoryId === cat.id && styles.pillTextActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>Foto do item (opcional)</Text>
              <TouchableOpacity style={styles.menuItemImagePicker} onPress={handlePickMenuItemImage} activeOpacity={0.85}>
                {miImagePreview ? (
                  <Image source={{ uri: miImagePreview }} style={styles.menuItemImagePreview} contentFit="cover" />
                ) : (
                  <View style={[styles.menuItemImagePreview, styles.imagePlaceholder]}>
                    <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuItemImagePickerText}>
                    {miImagePreview ? 'Trocar foto' : 'Escolher foto do item'}
                  </Text>
                  <Text style={styles.menuItemImagePickerSub}>Foto direto da galeria do celular</Text>
                </View>
                {miUploadingImage && <ActivityIndicator color={colors.secondary} />}
              </TouchableOpacity>

              {editingItem && (
                <>
                  <View style={styles.modalDivider} />
                  <Text style={styles.label}>Adicionais</Text>
                  {loadingAddons ? (
                    <ActivityIndicator color={colors.secondary} style={{ marginVertical: 10 }} />
                  ) : (
                    <>
                      {itemAddons.map((addon) => (
                        <View key={addon.id} style={styles.addonRow}>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => startEditAddon(addon)}>
                            <Text style={styles.addonRowName}>{addon.name}</Text>
                            <Text style={styles.addonRowPrice}>+ R$ {addon.price.toFixed(2)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => startEditAddon(addon)}>
                            <Ionicons name="pencil" size={16} color={colors.secondary} />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteAddon(addon)}>
                            <Ionicons name="trash-outline" size={16} color={colors.danger} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {itemAddons.length === 0 && (
                        <Text style={styles.emptySub}>Nenhum adicional ainda. Ex: bacon extra, borda recheada.</Text>
                      )}

                      <View style={styles.addAddonRow}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          value={addonName}
                          onChangeText={setAddonName}
                          placeholder="Nome (ex: Bacon extra)"
                          placeholderTextColor={colors.textMuted}
                        />
                        <TextInput
                          style={[styles.input, { width: 90 }]}
                          value={addonPrice}
                          onChangeText={setAddonPrice}
                          placeholder="R$"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        {editingAddonId && (
                          <TouchableOpacity style={styles.outlineBtn} onPress={resetAddonForm}>
                            <Text style={styles.outlineBtnText}>Cancelar</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.addCategoryBtn, { flex: 1, flexDirection: 'row', gap: 6 }, savingAddon && { opacity: 0.6 }]}
                          onPress={handleSaveAddon}
                          disabled={savingAddon}
                        >
                          {savingAddon ? (
                            <ActivityIndicator color={colors.white} />
                          ) : (
                            <>
                              <Ionicons name={editingAddonId ? 'checkmark' : 'add'} size={18} color={colors.white} />
                              <Text style={{ color: colors.white, fontWeight: '700', fontSize: 13 }}>
                                {editingAddonId ? 'Salvar adicional' : 'Adicionar'}
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setMenuModalVisible(false)}>
                  <Text style={styles.outlineBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1, marginTop: 0 }, savingItem && { opacity: 0.6 }]}
                  onPress={handleSaveMenuItem}
                  disabled={savingItem}
                >
                  {savingItem ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryBtnText}>Salvar</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  eyebrow: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.6, marginBottom: 2 },
  hello: { ...typography.h1, color: colors.text },
  sub: { color: colors.textMuted, marginTop: 2 },
  signOutBtn: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },

  // --- card de destaque (status ao vivo + números do dia) ---
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  heroTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroEyebrow: { fontSize: 10.5, color: 'rgba(255,255,255,0.75)', fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  heroStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroStatusTitle: { fontSize: 19, fontWeight: '800', color: colors.white },
  heroStatusSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 18 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStatItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroStatIconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroStatValue: { fontSize: 16, fontWeight: '800', color: colors.white },
  heroStatLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginTop: 1 },
  heroStatDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12 },

  pulseDotWrap: { width: 11, height: 11, alignItems: 'center', justifyContent: 'center' },
  pulseDotRing: { position: 'absolute', width: 11, height: 11, borderRadius: 5.5 },
  pulseDotCore: { width: 8, height: 8, borderRadius: 4 },

  // --- cards de seção com moldura (fotos, onboarding) ---
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { marginTop: 26 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  sectionIconCircle: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { ...typography.h2, color: colors.text, marginBottom: 12 },
  sectionCount: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  pendingBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadgeText: { color: colors.primary, fontSize: 11.5, fontWeight: '800' },

  emptyBox: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 20, padding: 32,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyText: { ...typography.bodyBold, color: colors.text, marginTop: 4 },
  emptySub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },

  menuBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center',
    backgroundColor: colors.secondaryLight, borderRadius: 14, padding: 16, marginBottom: 14,
  },
  menuBtnText: { color: colors.secondary, fontWeight: '700' },

  advanceBtn: {
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  advanceBtnFull: { marginTop: 10 },
  advanceBtnText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  orderCard: {
    backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1,
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
  orderItemsText: { color: colors.textMuted, fontSize: 12.5, lineHeight: 17 },

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

  menuItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 16, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  menuItemThumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.border },
  menuItemName: { ...typography.bodyBold, color: colors.text },
  menuItemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  menuItemPrice: { color: colors.secondary, fontSize: 13, fontWeight: '800' },
  menuItemCategoryTag: { backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  menuItemCategoryTagText: { color: colors.textMuted, fontSize: 10.5, fontWeight: '700' },
  menuItemActions: { flexDirection: 'row', gap: 6 },

  photosRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  logoPicker: { width: 76 },
  logoImage: { width: 76, height: 76, borderRadius: 18, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  bannerPicker: { flex: 1 },
  bannerImage: { width: '100%', height: 76, borderRadius: 18, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 4, borderStyle: 'dashed', borderWidth: 1.5, borderColor: colors.border },
  imagePlaceholderText: { fontSize: 10.5, color: colors.textMuted, fontWeight: '600' },
  photoCaption: { fontSize: 10.5, color: colors.textMuted, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  editBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center',
  },
  helperText: { color: colors.textMuted, fontSize: 12, marginTop: 12, lineHeight: 17 },

  menuItemImagePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 10, marginTop: 4,
    backgroundColor: colors.background,
  },
  menuItemImagePreview: { width: 52, height: 52, borderRadius: 12, backgroundColor: colors.border },
  menuItemImagePickerText: { ...typography.bodyBold, color: colors.text, fontSize: 13.5 },
  menuItemImagePickerSub: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },

  iconBtn: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },

  label: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.background,
  },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.background,
  },
  pillActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  pillText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  pillTextActive: { color: colors.white },
  pillWithAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  addCategoryRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addCategoryBtn: {
    width: 46, height: 46, borderRadius: 14, backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },

  primaryBtn: {
    marginTop: 20, backgroundColor: colors.primary, borderRadius: 14, height: 52,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3,
  },
  primaryBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  outlineBtn: {
    flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  outlineBtnText: { color: colors.text, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '88%',
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 14 },
  modalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { ...typography.h2, color: colors.text },
  modalCloseBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  modalDivider: { height: 1, backgroundColor: colors.border, marginTop: 18, marginBottom: 4 },

  addonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, backgroundColor: colors.surface,
  },
  addonRowName: { color: colors.text, fontSize: 14, fontWeight: '600' },
  addonRowPrice: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  addAddonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
});