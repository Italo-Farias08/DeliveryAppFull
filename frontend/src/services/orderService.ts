import { api } from './api';
import { Order } from '../types';

export interface CreateOrderPayload {
  restaurantId: string;
  addressId?: string;
  items: { menuItemId: string; qty: number; addonIds?: string[] }[];
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const { data } = await api.post('/orders', payload);
  return data;
}

export async function listMyOrders(): Promise<Order[]> {
  const { data } = await api.get('/orders');
  return data;
}

// Só funciona enquanto o pedido ainda está "pendente" (restaurante não
// começou o preparo) — o backend recusa (409) fora dessa janela.
export async function cancelOrder(orderId: string, reason?: string): Promise<{ id: string; status: string }> {
  const { data } = await api.patch(`/orders/${orderId}/cancel`, reason ? { reason } : {});
  return data;
}

export interface OrderMessage {
  id: string;
  senderRole: 'client' | 'restaurant';
  message: string;
  createdAt: string;
}

export async function getOrderMessages(orderId: string): Promise<OrderMessage[]> {
  const { data } = await api.get(`/orders/${orderId}/messages`);
  return data;
}

export async function sendOrderMessage(orderId: string, message: string): Promise<OrderMessage> {
  const { data } = await api.post(`/orders/${orderId}/messages`, { message });
  return data;
}