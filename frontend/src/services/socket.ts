import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, getAuthToken } from './api';

let socket: Socket | null = null;

// Deriva a URL do socket a partir da URL da API (remove o sufixo /api, se houver)
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export async function connectSocket(): Promise<Socket | null> {
  const token = await getAuthToken();
  if (!token) return null;

  if (socket && socket.connected) return socket;

  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}
