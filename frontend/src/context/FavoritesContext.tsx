import React, { createContext, useContext, useEffect, useState } from 'react';
import { Restaurant } from '../types';
import { addFavorite, listFavorites, removeFavorite } from '../services/favoriteService';
import { useAuth } from './AuthContext';

interface FavoritesContextData {
  favorites: Restaurant[];
  favoriteIds: Set<string>;
  loading: boolean;
  isFavorite: (restaurantId: string) => boolean;
  toggleFavorite: (restaurant: Restaurant) => Promise<void>;
  refresh: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextData>({} as FavoritesContextData);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    if (!user || user.role !== 'client') {
      setFavorites([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listFavorites();
      setFavorites(data);
    } catch {
      // se falhar, mantém o que já tinha carregado
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  function isFavorite(restaurantId: string) {
    return favorites.some((r) => r.id === restaurantId);
  }

  // Otimista: atualiza a lista na hora e só desfaz se a chamada falhar.
  async function toggleFavorite(restaurant: Restaurant) {
    const already = isFavorite(restaurant.id);
    if (already) {
      setFavorites((prev) => prev.filter((r) => r.id !== restaurant.id));
      try {
        await removeFavorite(restaurant.id);
      } catch {
        setFavorites((prev) => [restaurant, ...prev]);
      }
    } else {
      setFavorites((prev) => [restaurant, ...prev]);
      try {
        await addFavorite(restaurant.id);
      } catch {
        setFavorites((prev) => prev.filter((r) => r.id !== restaurant.id));
      }
    }
  }

  const favoriteIds = new Set(favorites.map((r) => r.id));

  return (
    <FavoritesContext.Provider
      value={{ favorites, favoriteIds, loading, isFavorite, toggleFavorite, refresh }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
