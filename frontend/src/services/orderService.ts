import { api } from './api';
import { Order } from '../types';

export type PaymentMethod = 'pix_app' | 'pix_entrega' | 'dinheiro' | 'cartao_credito' | 'cartao_debito';

export interface CreateOrderPayload {
  restaurantId: string;
  addressId?: string;
  paymentMethod: PaymentMethod;
  // "precisa de troco para quanto?" -- só enviar quando paymentMethod for 'dinheiro'
  changeFor?: number;
  items: { menuItemId: string; qty: number; addonIds?: string[] }[];
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const { data } = await api.post('/orders', payload);
  return data;
}

export async function listMyOrders(options?: { limit?: number; offset?: number }): Promise<Order[]> {
  const { data } = await api.get('/orders', { params: options });
  return data;
}

export interface PaymentLink {
  orderId: string;
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint?: string;
}

export async function payOrder(orderId: string): Promise<PaymentLink> {
  const { data } = await api.post(`/orders/${orderId}/pay`);
  return data;
}
export interface PixPayment {
  orderId: string;
  paymentId: number;
  status: string;
  qrCodeBase64: string;
  qrCode: string;
  expiresAt?: string;
}

export async function payOrderPix(orderId: string): Promise<PixPayment> {
  const { data } = await api.post(`/orders/${orderId}/pay-pix`);
  return data;
}

export async function cancelOrder(orderId: string, reason?: string): Promise<{ id: string; status: string }> {
  const { data } = await api.patch(`/orders/${orderId}/cancel`, reason ? { reason } : {});
  return data;
}

export interface OrderMessage {
  id: string;
  senderRole: 'client' | 'restaurant' | 'deliverer';
  message: string;
  createdAt: string;
}

export async function getOrderMessages(
  orderId: string,
  options?: { before?: string; limit?: number }
): Promise<OrderMessage[]> {
  const { data } = await api.get(`/orders/${orderId}/messages`, { params: options });
  return data;
}

export async function sendOrderMessage(orderId: string, message: string): Promise<OrderMessage> {
  const { data } = await api.post(`/orders/${orderId}/messages`, { message });
  return data;
}

export interface OrderRating {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

// Só funciona pra pedidos com status "entregue", e uma única vez por
// pedido -- o backend recusa (409) numa segunda tentativa.
export async function rateOrder(orderId: string, rating: number, comment?: string): Promise<OrderRating> {
  const { data } = await api.post(`/orders/${orderId}/rating`, comment ? { rating, comment } : { rating });
  return data;
}