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
  isOpen: boolean;
  menu: MenuItem[];
}

export interface CartItem {
  item: MenuItem;
  qty: number;
}

export type OrderStatus = 'preparando' | 'a caminho' | 'entregue';

export interface Order {
  id: string;
  restaurantName: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
}
