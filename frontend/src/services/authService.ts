import { api, USE_MOCK } from './api';
import { mockLogin } from './mockData';
import { User, UserRole } from '../types';

export async function login(email: string, password: string, role: UserRole): Promise<User> {
  if (USE_MOCK) {
    return mockLogin(email, role);
  }
  // Formato esperado quando o backend existir:
  const { data } = await api.post('/auth/login', { email, password, role });
  return data.user as User;
}

export async function register(name: string, email: string, password: string, role: UserRole): Promise<User> {
  if (USE_MOCK) {
    return mockLogin(email, role);
  }
  const { data } = await api.post('/auth/register', { name, email, password, role });
  return data.user as User;
}
