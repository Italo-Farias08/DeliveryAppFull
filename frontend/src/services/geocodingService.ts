// Busca de endereço usando o Nominatim (OpenStreetMap) — gratuito, sem API key.
//
// Atenção: a política de uso do Nominatim pede no máximo 1 requisição por
// segundo e não recomenda uso pesado de autocomplete em produção com
// muitos usuários (https://operations.osmfoundation.org/policies/nominatim/).
// Pra um app pequeno/médio funciona bem com o debounce que já colocamos no
// input. Se o app crescer bastante, o ideal é migrar pra um Nominatim
// próprio (self-hosted) ou um serviço pago (Google Places, Mapbox etc).
//
// Observação importante: cidades menores muitas vezes têm poucas ruas
// mapeadas no OpenStreetMap (a base de dados é feita por voluntários).
// Se uma busca não achar nada mesmo com o nome da rua certo, pode ser
// falta de dado no OSM pra aquela rua específica, não um bug daqui.

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
  distanceKm?: number;
}

// Região de busca: um "quadrado" em volta de um ponto (a localização atual
// da pessoa, normalmente), usado como preferência (não bloqueio rígido) —
// e um texto de cidade/estado que é colado na busca automaticamente quando
// a pessoa não digitou isso, pra ajudar o Nominatim a achar ruas locais.
// Esse mesmo ponto também é usado depois pra ordenar os resultados do mais
// perto pro mais longe.
export interface SearchBias {
  lat: number;
  lng: number;
  radiusDeg?: number;
  cityHint?: string; // ex: "Vitória de Santo Antão, PE"
}

function buildParams(query: string, bias?: SearchBias, useCityHint = true) {
  let q = query;
  if (useCityHint && bias?.cityHint) {
    const cityWord = bias.cityHint.split(',')[0].trim().toLowerCase();
    if (!q.toLowerCase().includes(cityWord)) {
      q = `${q}, ${bias.cityHint}`;
    }
  }

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '10',
    countrycodes: 'br',
    // Por padrão o Nominatim agrupa resultados parecidos (mesmo nome de
    // rua) num só, mesmo sendo ruas diferentes em bairros diferentes.
    // Desligando isso, cada rua com aquele nome aparece separadamente.
    dedupe: '0',
  });

  if (bias) {
    const r = bias.radiusDeg ?? 1.5;
    const left = bias.lng - r;
    const top = bias.lat + r;
    const right = bias.lng + r;
    const bottom = bias.lat - r;
    params.set('viewbox', `${left},${top},${right},${bottom}`);
    // bounded=0: usa a caixa como preferência de ranking, não como bloqueio
    // — assim uma rua local com pouco dado no OSM ainda pode aparecer.
    params.set('bounded', '0');
  }

  return params;
}

async function runSearch(params: URLSearchParams, signal?: AbortSignal): Promise<AddressSuggestion[]> {
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
  return (data as any[]).map((item) => {
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
}

// Distância em linha reta (haversine), em km — não é a distância de rota,
// mas é o suficiente pra ordenar "o que está mais perto de mim" na lista.
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function searchAddress(
  query: string,
  signal?: AbortSignal,
  bias?: SearchBias
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  // 1ª tentativa: com o nome da cidade colado no texto (se a pessoa não
  // digitou) + a região como preferência de ranking.
  let results = await runSearch(buildParams(trimmed, bias, true), signal);

  // 2ª tentativa: se nada apareceu, tenta sem colar a cidade — talvez a
  // pessoa já tenha digitado outra cidade de propósito, ou o texto com a
  // cidade colada não bateu com nada no OSM.
  if (results.length === 0 && bias?.cityHint) {
    results = await runSearch(buildParams(trimmed, bias, false), signal);
  }

  // 3ª tentativa: sem nenhum filtro geográfico — última chance antes de
  // desistir e mostrar "nenhum resultado".
  if (results.length === 0) {
    results = await runSearch(buildParams(trimmed, undefined, false), signal);
  }

  // Calcula a distância de cada resultado até o ponto de referência e
  // ordena do mais perto pro mais longe — o Nominatim ordena por
  // "importância"/match de texto, não por proximidade, então sem isso um
  // resultado de outro bairro podia aparecer antes de um bem mais perto.
  if (bias) {
    results = results
      .map((r) => ({ ...r, distanceKm: distanceKm(bias.lat, bias.lng, r.lat, r.lng) }))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  }

  return results;
}