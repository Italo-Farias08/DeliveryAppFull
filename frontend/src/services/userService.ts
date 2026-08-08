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

// Liga/desliga notificações no servidor -- é o backend que decide se manda
// push, mesmo com o app fechado, então o toggle precisa estar salvo lá.
export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await api.put('/users/me/notifications', { enabled });
}

export async function savePushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  await api.put('/users/me/push-token', { token, platform });
}

export async function removePushToken(token: string): Promise<void> {
  await api.delete('/users/me/push-token', { data: { token } });
}
