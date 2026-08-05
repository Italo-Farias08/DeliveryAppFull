// Busca de endereço usando o Nominatim (OpenStreetMap) — gratuito, sem API key.
//
// Atenção: a política de uso do Nominatim pede no máximo 1 requisição por
// segundo e não recomenda uso pesado de autocomplete em produção com
// muitos usuários (https://operations.osmfoundation.org/policies/nominatim/).
// Pra um app pequeno/médio funciona bem com o debounce que já colocamos no
// input. Se o app crescer bastante, o ideal é migrar pra um Nominatim
// próprio (self-hosted) ou um serviço pago (Google Places, Mapbox etc).

export interface AddressSuggestion {
  id: string;
  displayName: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat: number;
  lng: number;
}

// Região de busca: um "quadrado" em volta de um ponto (a localização atual
// da pessoa, normalmente). radiusDeg ~1.5 cobre bem uma região metropolitana
// e ainda deixa de fora cidades de outros estados bem distantes.
export interface SearchBias {
  lat: number;
  lng: number;
  radiusDeg?: number;
}

export async function searchAddress(
  query: string,
  signal?: AbortSignal,
  bias?: SearchBias
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: '6',
    countrycodes: 'br',
  });

  if (bias) {
    const r = bias.radiusDeg ?? 1.5;
    // viewbox = left(lon-),top(lat+),right(lon+),bottom(lat-)
    const left = bias.lng - r;
    const top = bias.lat + r;
    const right = bias.lng + r;
    const bottom = bias.lat - r;
    params.set('viewbox', `${left},${top},${right},${bottom}`);
    // bounded=1 restringe de verdade aos limites da caixa, em vez de só
    // "preferir" — é o que resolve resultado de longe aparecendo primeiro.
    params.set('bounded', '1');
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    signal,
    headers: {
      // Identificação exigida pela política de uso do Nominatim.
      'User-Agent': 'DeliveryAppFull/1.0',
      'Accept-Language': 'pt-BR',
    },
  });

  if (!response.ok) {
    throw new Error('Falha na busca de endereço');
  }

  const data = await response.json();
  let results = (data as any[]).map((item) => {
    const addr = item.address || {};
    return {
      id: String(item.place_id),
      displayName: item.display_name as string,
      street: addr.road || addr.pedestrian || addr.neighbourhood,
      number: addr.house_number,
      neighborhood: addr.suburb || addr.neighbourhood || addr.quarter,
      city: addr.city || addr.town || addr.village || addr.municipality,
      state: addr.state,
      zip: addr.postcode,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    } as AddressSuggestion;
  });

  // Se a busca restrita à região não achou nada (ex: rua rara ou a pessoa
  // realmente quer buscar em outra cidade), tenta de novo sem o limite,
  // em vez de simplesmente não mostrar resultado nenhum.
  if (results.length === 0 && bias) {
    return searchAddress(query, signal, undefined);
  }

  return results;
}