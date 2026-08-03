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
