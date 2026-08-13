import AsyncStorage from '@react-native-async-storage/async-storage';

// Histórico de buscas fica salvo NO APARELHO (AsyncStorage), não no
// servidor -- é só uma lista de termos recentes pra facilitar repetir uma
// busca, então não precisa de tabela no banco nem de rota na API.
const STORAGE_KEY = '@deliveryapp:searchHistory';
const MAX_ITEMS = 10;

export async function getSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Adiciona um termo no topo da lista. Se o termo (ignorando maiúsculas/
// minúsculas e espaços nas pontas) já existia, ele é movido pro topo em
// vez de duplicado.
export async function addSearchTerm(term: string): Promise<string[]> {
  const clean = term.trim();
  if (!clean) return getSearchHistory();

  const current = await getSearchHistory();
  const withoutDuplicate = current.filter((t) => t.toLowerCase() !== clean.toLowerCase());
  const updated = [clean, ...withoutDuplicate].slice(0, MAX_ITEMS);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function removeSearchTerm(term: string): Promise<string[]> {
  const current = await getSearchHistory();
  const updated = current.filter((t) => t.toLowerCase() !== term.toLowerCase());
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function clearSearchHistory(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
