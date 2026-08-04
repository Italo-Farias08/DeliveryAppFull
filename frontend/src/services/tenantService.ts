import { api } from './api';
import { Category, MenuItem, OrderStatus, Restaurant } from '../types';

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
