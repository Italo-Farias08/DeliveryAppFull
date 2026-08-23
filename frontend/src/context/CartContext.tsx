import React, { createContext, useContext, useMemo, useState } from 'react';
import { Addon, CartItem, MenuItem } from '../types';

interface CartContextData {
  items: CartItem[];
  restaurantId: string | null;
  addItem: (item: MenuItem, selectedAddons?: Addon[], notes?: string) => void;
  removeItem: (key: string) => void;
  decreaseItem: (key: string) => void;
  increaseItem: (key: string) => void;
  updateItemNotes: (key: string, notes: string) => void;
  clear: () => void;
  totalItems: number;
  subtotal: number;
}

const CartContext = createContext<CartContextData>({} as CartContextData);

// Cada linha do carrinho é identificada pelo item + a combinação exata de
// adicionais escolhidos, assim "X-Burger" e "X-Burger + bacon" viram duas
// linhas separadas em vez de se misturarem.
function buildKey(itemId: string, selectedAddons: Addon[]) {
  const addonIds = selectedAddons.map((a) => a.id).sort().join(',');
  return `${itemId}::${addonIds}`;
}

function lineUnitPrice(ci: CartItem) {
  const base = ci.item.promoPrice ?? ci.item.price;
  return base + ci.selectedAddons.reduce((s, a) => s + a.price, 0);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  function addItem(item: MenuItem, selectedAddons: Addon[] = [], notes: string = '') {
    const key = buildKey(item.id, selectedAddons);
    setItems((prev) => {
      // carrinho é de um restaurante por vez, como nos apps reais
      if (restaurantId && restaurantId !== item.restaurantId) {
        setRestaurantId(item.restaurantId);
        return [{ key, item, qty: 1, selectedAddons, notes }];
      }
      setRestaurantId(item.restaurantId);
      const existing = prev.find((ci) => ci.key === key);
      if (existing) {
        // repetir o "+" só aumenta a quantidade -- não apaga uma
        // observação que o cliente já tinha escrito pra essa linha
        return prev.map((ci) => (ci.key === key ? { ...ci, qty: ci.qty + 1 } : ci));
      }
      return [...prev, { key, item, qty: 1, selectedAddons, notes }];
    });
  }

  function updateItemNotes(key: string, notes: string) {
    setItems((prev) => prev.map((ci) => (ci.key === key ? { ...ci, notes } : ci)));
  }

  function increaseItem(key: string) {
    setItems((prev) => prev.map((ci) => (ci.key === key ? { ...ci, qty: ci.qty + 1 } : ci)));
  }

  function decreaseItem(key: string) {
    setItems((prev) =>
      prev.map((ci) => (ci.key === key ? { ...ci, qty: ci.qty - 1 } : ci)).filter((ci) => ci.qty > 0)
    );
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((ci) => ci.key !== key));
  }

  function clear() {
    setItems([]);
    setRestaurantId(null);
  }

  const totalItems = useMemo(() => items.reduce((s, ci) => s + ci.qty, 0), [items]);
  const subtotal = useMemo(
    () => items.reduce((s, ci) => s + ci.qty * lineUnitPrice(ci), 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        restaurantId,
        addItem,
        removeItem,
        decreaseItem,
        increaseItem,
        updateItemNotes,
        clear,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
