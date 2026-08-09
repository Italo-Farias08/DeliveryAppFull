export type UserRole = 'client' | 'restaurant' | 'deliverer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string | null;
  cpf?: string | null;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

// Categoria DENTRO do cardápio de um restaurante (ex: Pizzas, Carnes,
// Hambúrgueres). Diferente de "Category" acima, que é o TIPO do restaurante
// (Pizzaria, Hamburgueria) usado nos filtros da home do cliente.
export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
}

// Adicional de um item do cardápio (ex: "Bacon extra", "Borda recheada").
// O restaurante controla tudo (cria, edita, apaga) e o preço soma ao preço
// do item quando o cliente escolhe esse adicional.
export interface Addon {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  isAvailable?: boolean;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  // categoria do cardápio a que esse item pertence (opcional: item pode
  // não ter categoria e aparece em "Todos")
  categoryId?: string | null;
  name: string;
  description: string;
  price: number;
  image: string;
  isAvailable?: boolean;
  // opcional por compatibilidade com telas/dados antigos sem adicionais
  addons?: Addon[];
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
  // Endereço/GPS da loja em si — opcional porque restaurantes antigos
  // ainda não tinham preenchido isso.
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  // Opcional por compatibilidade com dados mockados antigos que ainda não
  // tinham categorias de cardápio.
  menuCategories?: MenuCategory[];
  menu: MenuItem[];
}

export interface CartItem {
  // chave única da linha do carrinho: mesmo item com adicionais diferentes
  // vira uma linha separada (ex: "X-Burger + bacon" e "X-Burger" puro)
  key: string;
  item: MenuItem;
  qty: number;
  selectedAddons: Addon[];
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
  restaurantId?: string;
  restaurantName: string;
  restaurantImage?: string | null;
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