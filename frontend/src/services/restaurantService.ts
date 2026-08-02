import { api, USE_MOCK } from './api';
import { categories, restaurants } from './mockData';
import { Category, Restaurant } from '../types';

export async function getCategories(): Promise<Category[]> {
  if (USE_MOCK) return new Promise((r) => setTimeout(() => r(categories), 300));
  const { data } = await api.get('/categories');
  return data;
}

export async function getRestaurants(categoryId?: string): Promise<Restaurant[]> {
  if (USE_MOCK) {
    return new Promise((resolve) =>
      setTimeout(() => {
        const list = categoryId ? restaurants.filter((r) => r.categoryId === categoryId) : restaurants;
        resolve(list);
      }, 400)
    );
  }
  const { data } = await api.get('/restaurants', { params: { categoryId } });
  return data;
}

export async function searchRestaurantsAndFoods(query: string): Promise<Restaurant[]> {
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
  const { data } = await api.get('/search', { params: { q: query } });
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
