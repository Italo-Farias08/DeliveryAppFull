import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import {
  PickedImage,
  RestaurantInput,
  TenantOrder,
  createRestaurant,
  getCategories,
  listMenuCategories,
  listMenuItems,
  listMyRestaurants,
  listOwnDeliverers,
  listTenantOrders,
  updateRestaurant,
  uploadRestaurantBanner,
  uploadRestaurantLogo,
} from '../services/tenantService';
import { connectSocket, disconnectSocket } from '../services/socket';
import { Category, MenuCategory, MenuItem, OrderStatus, OwnDeliverer, Restaurant } from '../types';

// Estado e ações compartilhadas entre as telas do painel do restaurante
// (Início, Pedidos, Cardápio, Localização, Configurações) — cada tela lê
// daqui em vez de recarregar tudo de novo sozinha. Ações específicas de
// cada tela (CRUD de item de cardápio, aceitar/recusar pedido...) ficam
// nas próprias telas, chamando os setters expostos aqui.
interface RestaurantContextData {
  loadingInit: boolean;
  refreshing: boolean;
  restaurant: Restaurant | null;
  setRestaurant: React.Dispatch<React.SetStateAction<Restaurant | null>>;
  categories: Category[];
  menuItems: MenuItem[];
  setMenuItems: React.Dispatch<React.SetStateAction<MenuItem[]>>;
  menuCategories: MenuCategory[];
  setMenuCategories: React.Dispatch<React.SetStateAction<MenuCategory[]>>;
  orders: TenantOrder[];
  setOrders: React.Dispatch<React.SetStateAction<TenantOrder[]>>;
  pendingCount: number;
  reload: (isRefresh?: boolean) => Promise<void>;

  // Entregadores da casa — vinculados só a este restaurante, pra usar na
  // hora de marcar um pedido como pronto ("usar meu entregador").
  ownDeliverers: OwnDeliverer[];
  setOwnDeliverers: React.Dispatch<React.SetStateAction<OwnDeliverer[]>>;
  reloadOwnDeliverers: () => Promise<void>;

  onboardingSaving: boolean;
  handleCreateRestaurant: (payload: RestaurantInput) => Promise<void>;

  savingStatus: boolean;
  handleToggleOpen: (value: boolean) => Promise<void>;

  uploadingLogo: boolean;
  uploadingBanner: boolean;
  handlePickRestaurantLogo: (picked: PickedImage) => Promise<void>;
  handlePickRestaurantBanner: (picked: PickedImage) => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextData>({} as RestaurantContextData);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
  const [loadingInit, setLoadingInit] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [orders, setOrders] = useState<TenantOrder[]>([]);
  const [ownDeliverers, setOwnDeliverers] = useState<OwnDeliverer[]>([]);

  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const reload = useCallback(async (isRefresh = false) => {
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
        // não bloqueia o carregamento principal se essa parte falhar --
        // o painel de pedidos/cardápio continua funcionando normalmente
        listOwnDeliverers().then(setOwnDeliverers).catch(() => {});
      }
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível carregar os dados do painel.');
    } finally {
      isRefresh ? setRefreshing(false) : setLoadingInit(false);
    }
  }, []);

  const reloadOwnDeliverers = useCallback(async () => {
    try {
      setOwnDeliverers(await listOwnDeliverers());
    } catch {
      // silencioso -- essa lista só afeta a opção "usar meu entregador",
      // não trava o resto do painel se falhar
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Novos pedidos chegam em tempo real, não importa qual aba do painel
  // está aberta no momento — por isso o socket vive aqui, no contexto,
  // e não numa tela específica.
  useEffect(() => {
    connectSocket().then((s) => {
      if (!s) return;
      s.on('order:new', (order: TenantOrder) => {
        setOrders((prev) => (prev.some((o) => o.id === order.id) ? prev : [order, ...prev]));
      });
      s.on('order:courierAssigned', () => {
        reload(true);
      });
      s.on('order:cancelled', ({ id, status, cancelReason }: { id: string; status: OrderStatus; cancelReason?: string }) => {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status, cancelReason } : o)));
      });
      // Presença real do entregador da casa (conectou/desconectou o
      // socket) -- atualiza o pontinho na hora, sem precisar puxar pra
      // atualizar nem trocar de aba pra recarregar.
      s.on('deliverer:presence', ({ delivererId, isOnline }: { delivererId: string; isOnline: boolean }) => {
        setOwnDeliverers((prev) => prev.map((d) => (d.id === delivererId ? { ...d, isOnline } : d)));
      });
    });
    return () => {
      disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateRestaurant(payload: RestaurantInput) {
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

  async function handlePickRestaurantLogo(picked: PickedImage) {
    if (!restaurant) return;
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

  async function handlePickRestaurantBanner(picked: PickedImage) {
    if (!restaurant) return;
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

  const pendingCount = orders.filter((o) => o.status === 'pendente').length;

  return (
    <RestaurantContext.Provider
      value={{
        loadingInit,
        refreshing,
        restaurant,
        setRestaurant,
        categories,
        menuItems,
        setMenuItems,
        menuCategories,
        setMenuCategories,
        orders,
        setOrders,
        pendingCount,
        reload,
        ownDeliverers,
        setOwnDeliverers,
        reloadOwnDeliverers,
        onboardingSaving,
        handleCreateRestaurant,
        savingStatus,
        handleToggleOpen,
        uploadingLogo,
        uploadingBanner,
        handlePickRestaurantLogo,
        handlePickRestaurantBanner,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

export function useRestaurantPanel() {
  return useContext(RestaurantContext);
}