import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { savePushToken, removePushToken } from './userService';

// Define como a notificação se comporta chegando com o app aberto
// (mostra alerta + som, mesmo em primeiro plano).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let cachedToken: string | null = null;

/**
 * Pede permissão, gera o token de push do Expo e salva no backend.
 * Retorna null se a pessoa negou a permissão ou está num simulador/emulador
 * (push real só funciona em dispositivo físico).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications exigem um dispositivo físico (não funciona em emulador/simulador).');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  // Precisa do projectId do EAS. Se ainda não existir, roda `npx eas init`
  // na pasta frontend/ -- isso cria o projeto no Expo e salva o id em
  // app.json automaticamente (extra.eas.projectId).
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.log(
      'Falta o projectId do EAS pra gerar o token de push. Rode "npx eas init" na pasta frontend/.'
    );
    return null;
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenResponse.data;
  cachedToken = token;

  try {
    await savePushToken(token, Platform.OS as 'ios' | 'android');
  } catch (err) {
    console.log('Não foi possível salvar o token de push no servidor:', err);
  }

  return token;
}

/** Remove o token deste aparelho no backend (ao desligar o sininho ou sair da conta). */
export async function unregisterPushNotifications(): Promise<void> {
  if (!cachedToken) return;
  try {
    await removePushToken(cachedToken);
  } catch (err) {
    console.log('Não foi possível remover o token de push no servidor:', err);
  } finally {
    cachedToken = null;
  }
}
