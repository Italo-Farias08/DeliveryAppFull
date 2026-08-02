import React, { createContext, useContext, useMemo, useState } from 'react';
import { CartItem, MenuItem } from '../types';

interface CartContextData {
  items: CartItem[];
  restaurantId: string | null;
  addItem: (item: MenuItem) => void;
  removeItem: (itemId: string) => void;
  decreaseItem: (itemId: string) => void;
  clear: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  function addItem(item: MenuItem) {
    setItems((prev) => {
      // carrinho é de um restaurante por vez, como nos apps reais
      if (restaurantId && restaurantId !== item.restaurantId) {
        setRestaurantId(item.restaurantId);
        return [{ item, qty: 1 }];
      }
      setRestaurantId(item.restaurantId);
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, qty: ci.qty + 1 } : ci
        );
      }
      return [...prev, { item, qty: 1 }];
    });
  }

  function decreaseItem(itemId: string) {
    setItems((prev) =>
      prev
        .map((ci) => (ci.item.id === itemId ? { ...ci, qty: ci.qty - 1 } : ci))
        .filter((ci) => ci.qty > 0)
    );
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
  }

  function clear() {
    setItems([]);
    setRestaurantId(null);
  }

  const totalItems = useMemo(() => items.reduce((s, ci) => s + ci.qty, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((s, ci) => s + ci.qty * ci.item.price, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{ items, restaurantId, addItem, removeItem, decreaseItem, clear, totalItems, subtotal }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
