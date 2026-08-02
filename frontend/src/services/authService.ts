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

export async function register(
  name: string,
  email: string,
  password: string,
  role: UserRole,
  cpf: string
): Promise<User> {
  if (USE_MOCK) {
    return mockLogin(email, role);
  }
  const { data } = await api.post('/auth/register', { name, email, password, role, cpf });
  await setAuthToken(data.token);
  return data.user as User;
}
