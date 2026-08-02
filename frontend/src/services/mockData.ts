import { Category, Restaurant, User, UserRole } from '../types';

export const categories: Category[] = [
  { id: 'cat-burger', name: 'Hambúrguer', icon: 'fast-food' },
  { id: 'cat-pizza', name: 'Pizza', icon: 'pizza' },
  { id: 'cat-sushi', name: 'Japonesa', icon: 'fish' },
  { id: 'cat-brasileira', name: 'Brasileira', icon: 'restaurant' },
  { id: 'cat-doces', name: 'Doces', icon: 'ice-cream' },
  { id: 'cat-saudavel', name: 'Saudável', icon: 'leaf' },
  { id: 'cat-bebidas', name: 'Bebidas', icon: 'wine' },
  { id: 'cat-mercado', name: 'Mercado', icon: 'cart' },
];

export const restaurants: Restaurant[] = [
  {
    id: 'r1',
    name: 'Brasa & Cia',
    categoryId: 'cat-burger',
    rating: 4.8,
    deliveryTimeMin: 25,
    deliveryTimeMax: 40,
    deliveryFee: 6.9,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
    isOpen: true,
    menu: [
      { id: 'm1', restaurantId: 'r1', name: 'Cheeseburger Duplo', description: 'Dois blends, queijo cheddar, molho da casa', price: 28.9, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400' },
      { id: 'm2', restaurantId: 'r1', name: 'Batata Rústica', description: 'Com alecrim e páprica defumada', price: 14.5, image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=400' },
      { id: 'm3', restaurantId: 'r1', name: 'Milk-shake de Ovomaltine', description: '400ml, cremoso', price: 16.0, image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400' },
    ],
  },
  {
    id: 'r2',
    name: 'Napoli Forno a Lenha',
    categoryId: 'cat-pizza',
    rating: 4.6,
    deliveryTimeMin: 35,
    deliveryTimeMax: 50,
    deliveryFee: 8.0,
    image: 'https://images.unsplash.com/photo-1548369937-47519962c11a?w=800',
    isOpen: true,
    menu: [
      { id: 'm4', restaurantId: 'r2', name: 'Margherita', description: 'Molho de tomate, mussarela de búfala, manjericão', price: 42.0, image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400' },
      { id: 'm5', restaurantId: 'r2', name: 'Calabresa Especial', description: 'Calabresa artesanal, cebola roxa, orégano', price: 39.9, image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400' },
    ],
  },
  {
    id: 'r3',
    name: 'Sakura Temaki',
    categoryId: 'cat-sushi',
    rating: 4.9,
    deliveryTimeMin: 30,
    deliveryTimeMax: 45,
    deliveryFee: 9.5,
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800',
    isOpen: true,
    menu: [
      { id: 'm6', restaurantId: 'r3', name: 'Combo 20 peças', description: 'Sashimi, uramaki e niguiri sortidos', price: 54.9, image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400' },
      { id: 'm7', restaurantId: 'r3', name: 'Temaki Salmão', description: 'Salmão fresco, cream cheese, cebolinha', price: 24.0, image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=400' },
    ],
  },
  {
    id: 'r4',
    name: 'Comida da Vó',
    categoryId: 'cat-brasileira',
    rating: 4.7,
    deliveryTimeMin: 20,
    deliveryTimeMax: 35,
    deliveryFee: 5.5,
    image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800',
    isOpen: false,
    menu: [
      { id: 'm8', restaurantId: 'r4', name: 'Feijoada Completa', description: 'Acompanha arroz, couve e farofa', price: 32.0, image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=400' },
    ],
  },
  {
    id: 'r5',
    name: 'Doce Ponto',
    categoryId: 'cat-doces',
    rating: 4.5,
    deliveryTimeMin: 15,
    deliveryTimeMax: 30,
    deliveryFee: 4.0,
    image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800',
    isOpen: true,
    menu: [
      { id: 'm9', restaurantId: 'r5', name: 'Brownie com Sorvete', description: 'Brownie quente, sorvete de creme', price: 19.9, image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400' },
    ],
  },
  {
    id: 'r6',
    name: 'Verde Vida',
    categoryId: 'cat-saudavel',
    rating: 4.4,
    deliveryTimeMin: 25,
    deliveryTimeMax: 40,
    deliveryFee: 7.0,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800',
    isOpen: true,
    menu: [
      { id: 'm10', restaurantId: 'r6', name: 'Bowl de Quinoa', description: 'Quinoa, grão-de-bico, legumes assados', price: 27.5, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400' },
    ],
  },
];

export function mockLogin(email: string, role: UserRole): Promise<User> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const name = email.split('@')[0] || 'Usuário';
      resolve({
        id: 'u-' + Date.now(),
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email,
        role,
      });
    }, 700);
  });
}
