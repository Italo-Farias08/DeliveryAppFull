import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3333/api';

// DEBUG TEMPORÁRIO — remova depois de resolver o problema de conexão.
// Isso mostra no terminal do Expo (e no console do celular) qual URL
// o app está de fato usando, pra confirmarmos se o .env foi carregado.
console.log('>>> API_BASE_URL em uso:', API_BASE_URL);

// Por padrão usa a API REAL. Só cai em mock se alguém pedir isso
// explicitamente (EXPO_PUBLIC_USE_MOCK=true) -- assim, se o .env sumir
// (ele é gitignored) ou não for carregado por algum motivo, o app nunca
// volta sozinho pra dados falsos sem avisar.
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK === 'true';

const TOKEN_KEY = '@deliveryapp:token';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export async function setAuthToken(token: string | null) {
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

export async function getAuthToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);