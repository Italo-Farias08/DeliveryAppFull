import { api } from './api';

export interface RadarOrder {
  id: string;
  total: number;
  deliveryFee?: number;
  createdAt: string;
  readyAt?: string | null;
  restaurantName: string;
  // endereço da loja — pra ir buscar o pedido
  restaurantStreet?: string;
  restaurantNumber?: string;
  restaurantNeighborhood?: string;
  restaurantCity?: string;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  // endereço do cliente — pra ir entregar
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
}

export interface MyDeliveryOrder {
  id: string;
  status: 'procurando_entregador' | 'a_caminho' | 'entregue' | 'cancelado';
  total: number;
  deliveryFee: number;
  createdAt: string;
  readyAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  restaurantName: string;
  // endereço da loja — pra ir buscar o pedido
  restaurantStreet?: string;
  restaurantNumber?: string;
  restaurantNeighborhood?: string;
  restaurantCity?: string;
  restaurantLat?: number | null;
  restaurantLng?: number | null;
  // endereço do cliente — pra ir entregar
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
}

export async function setAvailability(isAvailable: boolean): Promise<{ isAvailable: boolean }> {
  const { data } = await api.patch('/deliverer/availability', { isAvailable });
  return data;
}

export async function listAvailableOrders(): Promise<RadarOrder[]> {
  const { data } = await api.get('/deliverer/orders/available');
  return data;
}

export async function listMyDeliveries(): Promise<MyDeliveryOrder[]> {
  const { data } = await api.get('/deliverer/orders/mine');
  return data;
}

export async function acceptDelivery(orderId: string): Promise<{ id: string; status: string }> {
  const { data } = await api.patch(`/deliverer/orders/${orderId}/accept`);
  return data;
}

export async function confirmPickup(orderId: string, code: string): Promise<{ id: string; status: string }> {
  const { data } = await api.patch(`/deliverer/orders/${orderId}/confirm-pickup`, { code });
  return data;
}

export async function confirmDelivery(orderId: string, code: string): Promise<{ id: string; status: string }> {
  const { data } = await api.patch(`/deliverer/orders/${orderId}/confirm-delivery`, { code });
  return data;
}
