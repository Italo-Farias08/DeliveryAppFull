import { api } from './api';
import { User } from '../types';

export async function getMe(): Promise<User> {
  const { data } = await api.get('/users/me');
  return data;
}

export interface UpdateMePayload {
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
}

export async function updateMe(payload: UpdateMePayload): Promise<User> {
  const { data } = await api.put('/users/me', payload);
  return data;
}
