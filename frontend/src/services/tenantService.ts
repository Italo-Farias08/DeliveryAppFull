import { api } from './api';
import { Addon, Category, MenuCategory, MenuItem, OrderStatus, Restaurant } from '../types';

// Painel do restaurante — sempre fala com o backend de verdade (não tem mock aqui,
// já que é uma área autenticada específica do dono do restaurante).

export interface TenantOrder {
  id: string;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  acceptedAt?: string | null;
  readyAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  clientName?: string;
  clientPhone?: string | null;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  lat?: number | null;
  lng?: number | null;
  // código que o entregador precisa informar ao retirar o pedido no balcão
  pickupCode?: string;
  delivererName?: string | null;
  delivererPhone?: string | null;
  cancelReason?: string | null;
  items: { id: string; name: string; price: number; qty: number }[];
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get('/categories');
  return data;
}

export async function listMyRestaurants(): Promise<Restaurant[]> {
  const { data } = await api.get('/tenant/restaurants');
  return data;
}

export interface RestaurantInput {
  name: string;
  categoryId: string;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  image?: string;
  banner?: string;
  isOpen?: boolean;
}

export async function createRestaurant(payload: RestaurantInput): Promise<Restaurant> {
  const { data } = await api.post('/tenant/restaurants', payload);
  return data;
}

export async function updateRestaurant(id: string, payload: RestaurantInput): Promise<Restaurant> {
  const { data } = await api.put(`/tenant/restaurants/${id}`, payload);
  return data;
}

// Foto escolhida no picker do celular (ImagePicker.launchImageLibraryAsync)
// tem esse formato: uma URI local (file://...), sem nome/tipo garantidos.
export interface PickedImage {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
}

function guessFileName(uri: string, mimeType?: string | null) {
  const fromUri = uri.split('/').pop();
  if (fromUri && fromUri.includes('.')) return fromUri;
  const ext = mimeType?.split('/')?.[1] || 'jpg';
  return `upload.${ext}`;
}

function toFormData(fieldName: string, image: PickedImage): FormData {
  const form = new FormData();
  const name = image.name || guessFileName(image.uri, image.mimeType);
  // No React Native, o valor do campo de arquivo é esse objeto { uri, name, type }
  // (não um Blob), e o axios cuida do multipart/form-data automaticamente.
  form.append(fieldName, {
    uri: image.uri,
    name,
    type: image.mimeType || 'image/jpeg',
  } as any);
  return form;
}

// Envia a logo do restaurante. Retorna o restaurante já atualizado com a
// nova URL da imagem.
export async function uploadRestaurantLogo(restaurantId: string, image: PickedImage): Promise<Restaurant> {
  const form = toFormData('logo', image);
  const { data } = await api.post(`/tenant/restaurants/${restaurantId}/logo`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // uploads de imagem podem demorar mais que o timeout padrão (10s)
  });
  return data;
}

// Envia o banner (foto de capa) do restaurante.
export async function uploadRestaurantBanner(restaurantId: string, image: PickedImage): Promise<Restaurant> {
  const form = toFormData('banner', image);
  const { data } = await api.post(`/tenant/restaurants/${restaurantId}/banner`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}

// Envia a foto de um item específico do cardápio (o item já precisa existir).
export async function uploadMenuItemImage(menuItemId: string, image: PickedImage): Promise<MenuItem> {
  const form = toFormData('image', image);
  const { data } = await api.post(`/tenant/menu-items/${menuItemId}/image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  return data;
}

export async function listMenuItems(restaurantId: string): Promise<MenuItem[]> {
  const { data } = await api.get(`/tenant/restaurants/${restaurantId}/menu-items`);
  return data;
}

export interface MenuItemInput {
  name: string;
  description?: string;
  price: number;
  image?: string;
  isAvailable?: boolean;
  categoryId?: string | null;
}

export async function createMenuItem(restaurantId: string, payload: MenuItemInput): Promise<MenuItem> {
  const { data } = await api.post(`/tenant/restaurants/${restaurantId}/menu-items`, payload);
  return data;
}

export async function updateMenuItem(menuItemId: string, payload: MenuItemInput): Promise<MenuItem> {
  const { data } = await api.put(`/tenant/menu-items/${menuItemId}`, payload);
  return data;
}

export async function deleteMenuItem(menuItemId: string): Promise<void> {
  await api.delete(`/tenant/menu-items/${menuItemId}`);
}

// Categorias do cardápio (Pizzas, Carnes, Hambúrgueres...) — quem controla
// quais existem e a qual categoria cada item pertence é o próprio restaurante.
export async function listMenuCategories(restaurantId: string): Promise<MenuCategory[]> {
  const { data } = await api.get(`/tenant/restaurants/${restaurantId}/menu-categories`);
  return data;
}

export interface MenuCategoryInput {
  name: string;
  sortOrder?: number;
}

export async function createMenuCategory(restaurantId: string, payload: MenuCategoryInput): Promise<MenuCategory> {
  const { data } = await api.post(`/tenant/restaurants/${restaurantId}/menu-categories`, payload);
  return data;
}

export async function updateMenuCategory(categoryId: string, payload: MenuCategoryInput): Promise<MenuCategory> {
  const { data } = await api.put(`/tenant/menu-categories/${categoryId}`, payload);
  return data;
}

export async function deleteMenuCategory(categoryId: string): Promise<void> {
  await api.delete(`/tenant/menu-categories/${categoryId}`);
}

// Adicionais de um item do cardápio (ex: "Bacon extra", "Borda recheada") —
// o restaurante controla tudo: cria, edita nome/preço, apaga.
export interface AddonInput {
  name: string;
  price: number;
  isAvailable?: boolean;
}

export async function listAddons(menuItemId: string): Promise<Addon[]> {
  const { data } = await api.get(`/tenant/menu-items/${menuItemId}/addons`);
  return data;
}

export async function createAddon(menuItemId: string, payload: AddonInput): Promise<Addon> {
  const { data } = await api.post(`/tenant/menu-items/${menuItemId}/addons`, payload);
  return data;
}

export async function updateAddon(addonId: string, payload: AddonInput): Promise<Addon> {
  const { data } = await api.put(`/tenant/addons/${addonId}`, payload);
  return data;
}

export async function deleteAddon(addonId: string): Promise<void> {
  await api.delete(`/tenant/addons/${addonId}`);
}

export async function listTenantOrders(): Promise<TenantOrder[]> {
  const { data } = await api.get('/tenant/orders');
  return data;
}

export async function acceptOrder(orderId: string): Promise<{ id: string; status: OrderStatus }> {
  const { data } = await api.patch(`/tenant/orders/${orderId}/accept`);
  return data;
}

export async function rejectOrder(orderId: string, reason?: string): Promise<{ id: string; status: OrderStatus }> {
  const { data } = await api.patch(`/tenant/orders/${orderId}/reject`, { reason });
  return data;
}

export async function markOrderReady(orderId: string): Promise<{ id: string; status: OrderStatus }> {
  const { data } = await api.patch(`/tenant/orders/${orderId}/ready`);
  return data;
}

export interface TenantOrderMessage {
  id: string;
  senderRole: 'client' | 'restaurant';
  message: string;
  createdAt: string;
}

export async function getTenantOrderMessages(orderId: string): Promise<TenantOrderMessage[]> {
  const { data } = await api.get(`/tenant/orders/${orderId}/messages`);
  return data;
}

export async function sendTenantOrderMessage(orderId: string, message: string): Promise<TenantOrderMessage> {
  const { data } = await api.post(`/tenant/orders/${orderId}/messages`, { message });
  return data;
}