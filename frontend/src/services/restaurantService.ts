import { api, USE_MOCK } from './api';
import { categories, restaurants } from './mockData';
import { Category, FoodSearchResult, Restaurant } from '../types';

export async function getCategories(): Promise<Category[]> {
  if (USE_MOCK) return new Promise((r) => setTimeout(() => r(categories), 300));
  const { data } = await api.get('/categories');
  return data;
}

// coords é opcional -- quando o app não tem a localização do cliente
// ainda (sem permissão, por exemplo), o backend simplesmente não filtra
// por raio de entrega e devolve a lista normal.
export interface Coords {
  lat: number;
  lng: number;
}

export async function getRestaurants(categoryId?: string, coords?: Coords | null): Promise<Restaurant[]> {
  if (USE_MOCK) {
    return new Promise((resolve) =>
      setTimeout(() => {
        const list = categoryId ? restaurants.filter((r) => r.categoryId === categoryId) : restaurants;
        resolve(list);
      }, 400)
    );
  }
  const { data } = await api.get('/restaurants', {
    params: { categoryId, lat: coords?.lat, lng: coords?.lng },
  });
  return data;
}

export async function searchRestaurantsAndFoods(query: string, coords?: Coords | null): Promise<Restaurant[]> {
  if (USE_MOCK) {
    const q = query.trim().toLowerCase();
    return new Promise((resolve) =>
      setTimeout(() => {
        if (!q) return resolve([]);
        const result = restaurants.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            r.menu.some((m) => m.name.toLowerCase().includes(q))
        );
        resolve(result);
      }, 250)
    );
  }
  const { data } = await api.get('/search', { params: { q: query, lat: coords?.lat, lng: coords?.lng } });
  return data;
}

// Busca por ITEM de cardápio: pesquisar "carne" retorna os pratos que
// batem, cada um já com o nome/logo do restaurante de onde ele vem --
// diferente de `searchRestaurantsAndFoods`, que retorna restaurantes.
export async function searchFoodItems(query: string, coords?: Coords | null): Promise<FoodSearchResult[]> {
  if (USE_MOCK) {
    const q = query.trim().toLowerCase();
    return new Promise((resolve) =>
      setTimeout(() => {
        if (!q) return resolve([]);
        const results: FoodSearchResult[] = [];
        for (const r of restaurants) {
          for (const item of r.menu) {
            const matchesName = item.name.toLowerCase().includes(q);
            const matchesDesc = item.description?.toLowerCase().includes(q);
            if (matchesName || matchesDesc) {
              results.push({
                id: item.id,
                restaurantId: r.id,
                categoryId: item.categoryId,
                name: item.name,
                description: item.description,
                price: item.price,
                image: item.image,
                isAvailable: item.isAvailable,
                restaurantName: r.name,
                restaurantImage: r.image,
                restaurantIsOpen: r.isOpen,
              });
            }
          }
        }
        // resultados com match no NOME do prato aparecem antes dos que só
        // batem na descrição, igual à ordenação do backend
        results.sort((a, b) => {
          const aNameMatch = a.name.toLowerCase().includes(q) ? 0 : 1;
          const bNameMatch = b.name.toLowerCase().includes(q) ? 0 : 1;
          if (aNameMatch !== bNameMatch) return aNameMatch - bNameMatch;
          return a.name.localeCompare(b.name);
        });
        resolve(results);
      }, 250)
    );
  }
  const { data } = await api.get('/restaurants/search-items', {
    params: { q: query, lat: coords?.lat, lng: coords?.lng },
  });
  return data;
}

export async function getRestaurantById(id: string): Promise<Restaurant | undefined> {
  if (USE_MOCK) {
    return new Promise((resolve) =>
      setTimeout(() => resolve(restaurants.find((r) => r.id === id)), 200)
    );
  }
  const { data } = await api.get(`/restaurants/${id}`);
  return data;
}
