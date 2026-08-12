import { api } from './api';

export interface RadarOrder {
  id: string;
  total: number;
  deliveryFee?: number;
  createdAt: string;
  readyAt?: string | null;
  restaurantName: string;
  restaurantImage?: string | null;
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
  restaurantImage?: string | null;
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

// Devolve a corrida pro radar -- só funciona enquanto o pedido ainda não
// foi retirado na loja (status "procurando_entregador"). O backend recusa
// (409) se já tiver sido retirado.
export async function abandonDelivery(orderId: string): Promise<{ id: string; status: string }> {
  const { data } = await api.patch(`/deliverer/orders/${orderId}/abandon`);
  return data;
}

export interface DelivererOrderMessage {
  id: string;
  senderRole: 'client' | 'restaurant' | 'deliverer';
  message: string;
  createdAt: string;
}

export async function getDelivererOrderMessages(orderId: string): Promise<DelivererOrderMessage[]> {
  const { data } = await api.get(`/deliverer/orders/${orderId}/messages`);
  return data;
}

export async function sendDelivererOrderMessage(orderId: string, message: string): Promise<DelivererOrderMessage> {
  const { data } = await api.post(`/deliverer/orders/${orderId}/messages`, { message });
  return data;
}

export interface DelivererProfile {
  tenantId: string | null;
  tenantName?: string | null;
}

export async function getDelivererProfile(): Promise<DelivererProfile> {
  const { data } = await api.get('/deliverer/profile');
  return data;
}

export async function linkToRestaurant(inviteCode: string): Promise<{ tenantId: string; tenantName: string }> {
  const { data } = await api.post('/deliverer/link-restaurant', { inviteCode: inviteCode.trim() });
  return data;
}

export async function unlinkFromRestaurant(): Promise<{ tenantId: null }> {
  const { data } = await api.delete('/deliverer/link-restaurant');
  return data;
}