import { api } from './api';
import { Restaurant } from '../types';

export async function listFavorites(): Promise<Restaurant[]> {
  const { data } = await api.get('/favorites');
  return data;
}

export async function addFavorite(restaurantId: string): Promise<void> {
  await api.post('/favorites', { restaurantId });
}

export async function removeFavorite(restaurantId: string): Promise<void> {
  await api.delete(`/favorites/${restaurantId}`);
}
