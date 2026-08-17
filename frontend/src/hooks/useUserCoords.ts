import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Coords } from '../services/restaurantService';

// Cache simples em memória: a Home já teria acabado de pedir a
// localização (fetchLocation), então as outras telas (Buscar, Todos os
// restaurantes) reaproveitam o último ponto conhecido em vez de pedir
// permissão/GPS de novo a cada tela aberta. Fica só o tempo do app
// aberto -- não precisa persistir em disco.
let cachedCoords: Coords | null = null;

export function setCachedUserCoords(coords: Coords | null) {
  cachedCoords = coords;
}

// Retorna as coordenadas do cliente pra filtrar restaurantes por raio de
// entrega. Não pede a permissão de novo se já tiver sido negada ou já
// tiver um ponto em cache -- só tenta uma vez em silêncio, sem travar a
// tela nem mostrar erro (a busca/lista simplesmente volta a funcionar
// sem o filtro de distância se não conseguir a localização).
export function useUserCoords(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(cachedCoords);

  useEffect(() => {
    if (cachedCoords) {
      setCoords(cachedCoords);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        cachedCoords = next;
        if (!cancelled) setCoords(next);
      } catch {
        // sem localização -> segue sem filtro de distância
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return coords;
}
