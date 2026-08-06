import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { setAuthToken } from '../services/api';

interface AuthContextData {
  user: User | null;
  loading: boolean;
  signIn: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (user: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);
const STORAGE_KEY = '@deliveryapp:user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setUser(JSON.parse(raw));
      })
      .finally(() => setLoading(false));
  }, []);

  async function signIn(newUser: User) {
    setUser(newUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  }

  async function signOut() {
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
    await setAuthToken(null);
  }

  // Atualiza o usuário em memória e no AsyncStorage depois que a pessoa
  // edita nome/e-mail/telefone/CPF na tela "Meus dados".
  async function updateUser(updated: User) {
    setUser(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
