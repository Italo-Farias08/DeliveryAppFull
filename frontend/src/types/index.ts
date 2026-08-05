export type UserRole = 'client' | 'restaurant' | 'deliverer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  isAvailable?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  categoryId: string;
  rating: number;
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  deliveryFee: number;
  image: string;
  // Foto de capa da loja (diferente da logo). Opcional porque restaurantes
  // antigos ainda não tinham esse campo.
  banner?: string | null;
  isOpen: boolean;
  menu: MenuItem[];
}

export interface CartItem {
  item: MenuItem;
  qty: number;
}

export type OrderStatus =
  | 'pendente'
  | 'preparando'
  | 'procurando_entregador'
  | 'a_caminho'
  | 'entregue'
  | 'cancelado';

export interface Order {
  id: string;
  restaurantName: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  acceptedAt?: string | null;
  readyAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  // código que o CLIENTE mostra para o entregador confirmar a entrega
  deliveryCode?: string;
  delivererName?: string | null;
  delivererPhone?: string | null;
  items: { id: string; name: string; price: number; qty: number }[];
}
