import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RestaurantCard } from '../../components/RestaurantCard';
import { SearchBar } from '../../components/SearchBar';
import { searchRestaurantsAndFoods } from '../../services/restaurantService';
import { colors } from '../../theme/colors';
import { Restaurant } from '../../types';

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      searchRestaurantsAndFoods(query).then((r) => {
        setResults(r);
        setLoading(false);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <SearchBar value={query} onChangeText={setQuery} autoFocus placeholder="Pizza, hambúrguer, sushi..." />
        </View>
      </View>

      {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />}

      {!loading && query.trim() !== '' && results.length === 0 && (
        <Text style={styles.emptyText}>Nada encontrado para "{query}"</Text>
      )}

      {!loading && query.trim() === '' && (
        <Text style={styles.hintText}>Digite o nome de um restaurante ou prato</Text>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 20, paddingTop: 12 }}
        renderItem={({ item }) => (
          <RestaurantCard
            restaurant={item}
            onPress={() => navigation.navigate('RestaurantDetail', { restaurantId: item.id })}
          />
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', color: colors.textMuted, marginTop: 30 },
  hintText: { textAlign: 'center', color: colors.textMuted, marginTop: 30 },
});
