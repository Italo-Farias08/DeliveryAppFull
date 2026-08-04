import { api } from './api';
import { Order } from '../types';

export interface CreateOrderPayload {
  restaurantId: string;
  addressId?: string;
  items: { menuItemId: string; qty: number }[];
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const { data } = await api.post('/orders', payload);
  return data;
}

export async function listMyOrders(): Promise<Order[]> {
  const { data } = await api.get('/orders');
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
