import { api, USE_MOCK, setAuthToken } from './api';
import { mockLogin } from './mockData';
import { User, UserRole } from '../types';

// Etapa 1: valida e-mail + senha e dispara o código de verificação por e-mail
export async function requestLoginCode(email: string, password: string): Promise<{ pending: true; email: string }> {
  if (USE_MOCK) {
    return { pending: true, email };
  }
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

// Etapa 2: confirma o código recebido por e-mail e retorna o usuário autenticado
export async function verifyLoginCode(email: string, code: string, role: UserRole): Promise<User> {
  if (USE_MOCK) {
    return mockLogin(email, role);
  }
  const { data } = await api.post('/auth/login/verify-code', { email, code });
  await setAuthToken(data.token);
  return data.user as User;
}

export interface RegisterClientPayload {
  role: 'client';
  name: string;
  email: string;
  password: string;
  cpf: string;
  phone?: string;
}

export interface RegisterDelivererPayload {
  role: 'deliverer';
  name: string;
  email: string;
  password: string;
  cpf: string;
  vehicleType: 'moto' | 'bike' | 'carro';
  vehiclePlate?: string;
  phone?: string;
}

export interface RegisterRestaurantPayload {
  role: 'restaurant';
  name: string;
  email: string;
  password: string;
  businessName: string;
  cnpj: string;
  phone?: string;
}

export type RegisterPayload = RegisterClientPayload | RegisterDelivererPayload | RegisterRestaurantPayload;

export async function register(payload: RegisterPayload): Promise<User> {
  if (USE_MOCK) {
    return mockLogin(payload.email, payload.role);
  }
  const { data } = await api.post('/auth/register', payload);
  await setAuthToken(data.token);
  return data.user as User;
}