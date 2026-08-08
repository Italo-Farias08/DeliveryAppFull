import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
} from '../services/pushNotifications';
import { setNotificationsEnabled as setNotificationsEnabledOnServer } from '../services/userService';

const STORAGE_PREFIX = '@notifications_enabled:';

interface NotificationsContextData {
  enabled: boolean;
  ready: boolean;
  toggle: () => Promise<void>;
  setEnabled: (value: boolean) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextData>({} as NotificationsContextData);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // liga por padrão -- só desliga se a pessoa desligar de propósito
  const [enabled, setEnabledState] = useState(true);
  const [ready, setReady] = useState(false);

  const storageKey = `${STORAGE_PREFIX}${user?.id ?? 'guest'}`;

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    AsyncStorage.getItem(storageKey)
      .then((stored) => {
        if (cancelled) return;
        // se nunca foi salvo nada, mantém o padrão (ligado)
        const value = stored !== null ? stored === 'true' : true;
        setEnabledState(value);
        // se está ligado e tem usuário logado, garante que o token de push
        // deste aparelho está registrado no servidor (ex: reinstalou o app,
        // trocou de celular, ou é o primeiro login)
        if (value && user) {
          registerForPushNotifications();
        }
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, user?.id]);

  async function persist(value: boolean) {
    setEnabledState(value);
    try {
      await AsyncStorage.setItem(storageKey, String(value));
    } catch {
      // se der erro pra salvar, mantém o valor em memória mesmo assim --
      // a pessoa continua vendo o toggle mudar, só não sobrevive a um restart
    }

    // reflete no backend -- é ele que decide se manda push com o app fechado
    try {
      await setNotificationsEnabledOnServer(value);
    } catch {
      // sem internet/backend fora do ar: o toggle local já foi salvo, e o
      // próximo persist() bem-sucedido corrige o servidor
    }

    if (value) {
      await registerForPushNotifications();
    } else {
      await unregisterPushNotifications();
    }
  }

  async function toggle() {
    await persist(!enabled);
  }

  async function setEnabled(value: boolean) {
    await persist(value);
  }

  return (
    <NotificationsContext.Provider value={{ enabled, ready, toggle, setEnabled }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
