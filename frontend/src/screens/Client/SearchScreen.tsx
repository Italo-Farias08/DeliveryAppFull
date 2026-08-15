import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FoodSearchResultCard } from '../../components/FoodSearchResultCard';
import { SearchBar } from '../../components/SearchBar';
import { searchFoodItems } from '../../services/restaurantService';
import {
  addSearchTerm,
  clearSearchHistory,
  getSearchHistory,
  removeSearchTerm,
} from '../../services/searchHistoryService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { FoodSearchResult } from '../../types';

export default function SearchScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  // Só foca o campo (abrindo o teclado) depois que a animação de entrada
  // da tela terminar. Focar de cara com autoFocus faz o teclado subir ao
  // mesmo tempo que a transição de navegação roda, e as duas animações
  // brigam pelo mesmo frame -- é isso que dava a sensação de travado.
  useEffect(() => {
    const unsubscribe = navigation.addListener('transitionEnd', () => {
      inputRef.current?.focus();
    });
    return unsubscribe;
  }, [navigation]);

  // Carrega o histórico salvo no aparelho assim que a tela abre.
  useEffect(() => {
    getSearchHistory().then(setHistory);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      searchFoodItems(query).then((r) => {
        setResults(r);
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  // Salva o termo no histórico -- só quando a busca é "confirmada" (tecla
  // de busca do teclado ou toque num resultado), não a cada letra digitada,
  // senão o histórico ficaria cheio de "c", "ca", "car"...
  async function saveToHistory(term: string) {
    const updated = await addSearchTerm(term);
    setHistory(updated);
  }

  async function handleRemoveHistoryTerm(term: string) {
    const updated = await removeSearchTerm(term);
    setHistory(updated);
  }

  async function handleClearHistory() {
    await clearSearchHistory();
    setHistory([]);
  }

  function handleSelectHistoryTerm(term: string) {
    setQuery(term);
  }

  function handleSelectResult(item: FoodSearchResult) {
    saveToHistory(query);
    navigation.navigate('RestaurantDetail', { restaurantId: item.restaurantId });
  }

  const showHistory = query.trim() === '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <SearchBar
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Carne, pizza, sushi..."
            onSubmitEditing={() => query.trim() && saveToHistory(query)}
          />
        </View>
      </View>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />}

      {!loading && !showHistory && results.length === 0 && (
        <Text style={styles.emptyText}>Nada encontrado para "{query}"</Text>
      )}

      {showHistory && (
        <FlatList
          data={history}
          keyExtractor={(term) => term}
          contentContainerStyle={{ padding: 20, paddingTop: 12 }}
          ListHeaderComponent={
            history.length > 0 ? (
              <View style={styles.historyHeader}>
                <Text style={styles.historyTitle}>Buscas recentes</Text>
                <TouchableOpacity onPress={handleClearHistory}>
                  <Text style={styles.clearText}>Limpar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.hintText}>Digite o nome de um prato, ex: "carne"</Text>
            )
          }
          renderItem={({ item: term }) => (
            <TouchableOpacity style={styles.historyRow} onPress={() => handleSelectHistoryTerm(term)}>
              <Ionicons name="time-outline" size={18} color={colors.textMuted} />
              <Text style={styles.historyText} numberOfLines={1}>{term}</Text>
              <TouchableOpacity
                onPress={() => handleRemoveHistoryTerm(term)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {!showHistory && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingTop: 12 }}
          renderItem={({ item }) => (
            <FoodSearchResultCard item={item} onPress={() => handleSelectResult(item)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 30 },
  hintText: { textAlign: 'center', color: colors.textMuted, marginTop: 30 },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyTitle: { ...typography.h2, fontSize: 15, color: colors.text },
  clearText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyText: { flex: 1, fontSize: 14.5, color: colors.text },
});
};
