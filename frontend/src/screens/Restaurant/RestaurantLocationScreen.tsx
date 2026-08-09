import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RestaurantScreenLayout from '../../components/RestaurantScreenLayout';
import { useRestaurantPanel } from '../../context/RestaurantContext';
import { AddressSuggestion, SearchBias, searchAddress } from '../../services/geocodingService';
import { RestaurantLocationInput, updateRestaurantLocation } from '../../services/tenantService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const SEARCH_DEBOUNCE_MS = 500;

// Mesmo ponto de referência usado na busca de endereço do cliente — mantém
// os resultados relevantes pra região onde o app roda hoje.
const REGION_BIAS: SearchBias = {
  lat: -8.1219,
  lng: -35.2939,
  radiusDeg: 1.2,
  cityHint: 'Vitória de Santo Antão, PE',
};

function suggestionPrimary(s: AddressSuggestion) {
  const line = [s.street, s.number].filter(Boolean).join(', ');
  return line || s.displayName.split(',')[0];
}

function suggestionSecondary(s: AddressSuggestion) {
  const place = [s.neighborhood, s.city].filter(Boolean).join(' · ');
  const dist = s.distanceKm != null ? (s.distanceKm < 1 ? `${Math.round(s.distanceKm * 1000)} m` : `${s.distanceKm.toFixed(1)} km`) : null;
  return [place, dist].filter(Boolean).join(' — ') || undefined;
}

export default function RestaurantLocationScreen() {
  const { restaurant, setRestaurant } = useRestaurantPanel();

  const hasSavedLocation = !!restaurant?.street;

  // Campo de busca (igual à tela de endereços do cliente) — digita e
  // escolhe uma sugestão, ou usa o GPS direto.
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [editing, setEditing] = useState(!hasSavedLocation);
  const [selected, setSelected] = useState(hasSavedLocation);
  const [street, setStreet] = useState(restaurant?.street || '');
  const [number, setNumber] = useState(restaurant?.number || '');
  const [complement, setComplement] = useState(restaurant?.complement || '');
  const [neighborhood, setNeighborhood] = useState(restaurant?.neighborhood || '');
  const [city, setCity] = useState(restaurant?.city || '');
  const [state, setState] = useState(restaurant?.state || '');
  const [zip, setZip] = useState(restaurant?.zip || '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    restaurant?.lat != null && restaurant?.lng != null ? { lat: restaurant.lat, lng: restaurant.lng } : null
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchOrigin, setSearchOrigin] = useState<SearchBias>(REGION_BIAS);

  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then((pos) => {
        if (pos) setSearchOrigin({ ...REGION_BIAS, lat: pos.coords.latitude, lng: pos.coords.longitude });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (selected || searchText.trim().length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(null);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const results = await searchAddress(searchText, controller.signal, searchOrigin);
        setSuggestions(results);
      } catch (err: any) {
        if (err?.name !== 'AbortError') setSearchError('Não foi possível buscar. Tente de novo.');
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText, selected, searchOrigin]);

  function handlePickSuggestion(s: AddressSuggestion) {
    setStreet(s.street || '');
    setNumber(s.number || '');
    setNeighborhood(s.neighborhood || '');
    setCity(s.city || '');
    setState(s.state || '');
    setZip(s.zip || '');
    setCoords({ lat: s.lat, lng: s.lng });
    setSearchText(s.displayName);
    setSuggestions([]);
    setSelected(true);
  }

  async function handleUseCurrentLocation() {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão negada', 'Ative a permissão de localização para usar essa opção.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      setCoords({ lat: latitude, lng: longitude });

      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        const streetName = place.street || place.name || '';
        setStreet(streetName);
        setNumber(place.streetNumber || '');
        setNeighborhood(place.district || place.subregion || '');
        setCity(place.city || place.subregion || '');
        setState(place.region || '');
        setZip(place.postalCode || '');
        setSearchText(streetName);
      }
      setSelected(true);
      setSuggestions([]);
    } catch {
      Alert.alert('Erro', 'Não foi possível obter sua localização.');
    } finally {
      setLocating(false);
    }
  }

  function startEdit() {
    setSearchText('');
    setSuggestions([]);
    setSelected(hasSavedLocation);
    setEditing(true);
  }

  function cancelEdit() {
    if (!hasSavedLocation) return; // sem endereço salvo ainda, não tem pra onde voltar
    setStreet(restaurant?.street || '');
    setNumber(restaurant?.number || '');
    setComplement(restaurant?.complement || '');
    setNeighborhood(restaurant?.neighborhood || '');
    setCity(restaurant?.city || '');
    setState(restaurant?.state || '');
    setZip(restaurant?.zip || '');
    setCoords(restaurant?.lat != null && restaurant?.lng != null ? { lat: restaurant.lat, lng: restaurant.lng } : null);
    setSearchText('');
    setSuggestions([]);
    setSelected(true);
    setEditing(false);
  }

  async function handleSave() {
    if (!restaurant) return;
    if (street.trim().length < 2 || city.trim().length < 2 || state.trim().length < 2) {
      Alert.alert('Faltam dados', 'Busque o endereço acima ou preencha ao menos rua, cidade e estado.');
      return;
    }
    setSaving(true);
    try {
      const payload: RestaurantLocationInput = {
        street: street.trim(),
        number: number.trim() || undefined,
        complement: complement.trim() || undefined,
        neighborhood: neighborhood.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim() || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
      };
      const updated = await updateRestaurantLocation(restaurant.id, payload);
      setRestaurant(updated);
      setEditing(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar a localização da loja.');
    } finally {
      setSaving(false);
    }
  }

  if (!restaurant) return null;

  return (
    <RestaurantScreenLayout title="Localização" subtitle="Endereço da sua loja" active="Location">
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.infoBanner}>
          <Ionicons name="bicycle-outline" size={16} color={colors.secondary} />
          <Text style={styles.infoBannerText}>
            Esse é o endereço que o entregador usa pra achar sua loja na hora de retirar o pedido.
          </Text>
        </View>

        {!editing && hasSavedLocation && (
          <View style={styles.savedCard}>
            <View style={styles.savedIcon}>
              <Ionicons name="storefront" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savedLine1}>
                {[restaurant.street, restaurant.number].filter(Boolean).join(', ')}
                {restaurant.complement ? ` — ${restaurant.complement}` : ''}
              </Text>
              <Text style={styles.savedLine2}>
                {[restaurant.neighborhood, restaurant.city, restaurant.state].filter(Boolean).join(' · ')}
              </Text>
              {restaurant.zip && <Text style={styles.savedLine2}>CEP {restaurant.zip}</Text>}
              {restaurant.lat != null && restaurant.lng != null && <Text style={styles.gpsTag}>GPS salvo</Text>}
            </View>
            <TouchableOpacity style={styles.editBtn} onPress={startEdit}>
              <Ionicons name="pencil-outline" size={16} color={colors.secondary} />
            </TouchableOpacity>
          </View>
        )}

        {editing && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Buscar endereço</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={(text) => {
                    setSearchText(text);
                    setSelected(false);
                  }}
                  placeholder="Rua, bairro, cidade..."
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                />
                {searching && <ActivityIndicator size="small" color={colors.primary} />}
                {!searching && searchText.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchText(''); setSelected(false); setSuggestions([]); }}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {!selected && suggestions.length > 0 && (
                <ScrollView style={styles.suggestionsBox} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  {suggestions.map((s) => (
                    <TouchableOpacity key={s.id} style={styles.suggestionRow} onPress={() => handlePickSuggestion(s)}>
                      <Ionicons name="location-outline" size={16} color={colors.primary} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionPrimary} numberOfLines={1}>{suggestionPrimary(s)}</Text>
                        {suggestionSecondary(s) && (
                          <Text style={styles.suggestionSecondary} numberOfLines={1}>{suggestionSecondary(s)}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {!selected && !searching && searchError && <Text style={styles.searchErrorText}>{searchError}</Text>}
              {!selected && !searching && !searchError && searchText.trim().length >= 3 && suggestions.length === 0 && (
                <Text style={styles.searchHint}>Nenhum resultado encontrado.</Text>
              )}

              <TouchableOpacity
                style={[styles.locationBtn, locating && { opacity: 0.6 }]}
                onPress={handleUseCurrentLocation}
                disabled={locating}
              >
                {locating ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Ionicons name="locate" size={16} color={colors.primary} />
                    <Text style={styles.locationBtnText}>Usar minha localização atual</Text>
                  </>
                )}
              </TouchableOpacity>

              {selected && (
                <>
                  <View style={styles.confirmedBox}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.secondary} />
                    <Text style={styles.confirmedText}>Endereço selecionado — confira e complete abaixo</Text>
                  </View>

                  <Text style={styles.formLabel}>Rua</Text>
                  <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="Nome da rua" placeholderTextColor={colors.textMuted} />

                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Número</Text>
                      <TextInput style={styles.input} value={number} onChangeText={setNumber} placeholder="123" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Complemento</Text>
                      <TextInput style={styles.input} value={complement} onChangeText={setComplement} placeholder="Loja, sala..." placeholderTextColor={colors.textMuted} />
                    </View>
                  </View>

                  <Text style={styles.formLabel}>Bairro</Text>
                  <TextInput style={styles.input} value={neighborhood} onChangeText={setNeighborhood} placeholder="Bairro" placeholderTextColor={colors.textMuted} />

                  <View style={styles.row2}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.formLabel}>Cidade</Text>
                      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Cidade" placeholderTextColor={colors.textMuted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Estado</Text>
                      <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="UF" placeholderTextColor={colors.textMuted} maxLength={2} autoCapitalize="characters" />
                    </View>
                  </View>

                  <Text style={styles.formLabel}>CEP</Text>
                  <TextInput style={styles.input} value={zip} onChangeText={setZip} placeholder="00000-000" placeholderTextColor={colors.textMuted} keyboardType="number-pad" />
                </>
              )}

              <View style={styles.formActions}>
                {hasSavedLocation && (
                  <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit}>
                    <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.saveBtn, (saving || !selected) && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={saving || !selected}
                >
                  {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Salvar localização</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </ScrollView>
    </RestaurantScreenLayout>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.secondaryLight, borderRadius: 14, padding: 12, marginBottom: 16,
  },
  infoBannerText: { flex: 1, color: colors.text, fontSize: 12.5, lineHeight: 17 },

  savedCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  savedIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  savedLine1: { ...typography.bodyBold, color: colors.text, fontSize: 14.5 },
  savedLine2: { color: colors.textMuted, fontSize: 12.5, marginTop: 3 },
  gpsTag: { color: colors.secondary, fontSize: 10.5, fontWeight: '700', marginTop: 6 },
  editBtn: {
    width: 34, height: 34, borderRadius: 11, backgroundColor: colors.background,
    alignItems: 'center', justifyContent: 'center',
  },

  formCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  formLabel: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginTop: 12, marginBottom: 6 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 12, backgroundColor: colors.background,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14.5, color: colors.text },
  suggestionsBox: {
    marginTop: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: colors.surface, maxHeight: 260,
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  suggestionPrimary: { fontSize: 13.5, fontWeight: '700', color: colors.text },
  suggestionSecondary: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  searchErrorText: { color: colors.danger, fontSize: 12, marginTop: 6 },
  searchHint: { color: colors.textMuted, fontSize: 12, marginTop: 6 },

  confirmedBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  confirmedText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },

  locationBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12,
    paddingVertical: 12, marginTop: 14,
  },
  locationBtnText: { color: colors.primary, fontWeight: '700', fontSize: 13.5 },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 14.5, color: colors.text, backgroundColor: colors.background,
  },
  row2: { flexDirection: 'row', gap: 10 },

  formActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { color: colors.textMuted, fontWeight: '700' },
  saveBtn: { flex: 2, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  saveBtnText: { color: colors.white, fontWeight: '700' },
});
