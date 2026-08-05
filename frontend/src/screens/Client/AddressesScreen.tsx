import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Address,
  CreateAddressPayload,
  createAddress,
  deleteAddress,
  listAddresses,
} from '../../services/addressService';
import { AddressSuggestion, SearchBias, searchAddress } from '../../services/geocodingService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const LABELS = ['Casa', 'Trabalho', 'Outro'];
const SEARCH_DEBOUNCE_MS = 500;

// Por enquanto fixo em Vitória de Santo Antão, PE — depois dá pra trocar
// isso pra pegar a localização atual da pessoa dinamicamente (device GPS)
// em vez de um ponto fixo, se o app for usado em várias cidades/regiões.
const REGION_BIAS: SearchBias = {
  lat: -8.1219,
  lng: -35.2939,
  radiusDeg: 1.2,
  cityHint: 'Vitória de Santo Antão, PE',
};

function addressLine(a: { street: string; number?: string | null; neighborhood?: string | null; city: string }) {
  const parts = [a.street, a.number].filter(Boolean).join(', ');
  const rest = [a.neighborhood, a.city].filter(Boolean).join(' · ');
  return [parts, rest].filter(Boolean).join(' — ');
}

function labelIcon(label?: string | null) {
  if (label === 'Casa') return 'home-outline';
  if (label === 'Trabalho') return 'briefcase-outline';
  return 'location-outline';
}

function suggestionPrimary(s: AddressSuggestion) {
  const line = [s.street, s.number].filter(Boolean).join(', ');
  return line || s.displayName.split(',')[0];
}

function suggestionSecondary(s: AddressSuggestion) {
  const place = [s.neighborhood, s.city].filter(Boolean).join(' · ');
  const dist = s.distanceKm != null ? `${s.distanceKm < 1 ? Math.round(s.distanceKm * 1000) + ' m' : s.distanceKm.toFixed(1) + ' km'}` : null;
  return [place, dist].filter(Boolean).join(' — ') || undefined;
}

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState('Casa');

  // Campo de busca (estilo Uber/Google Maps) — o que a pessoa digita e a
  // lista de sugestões que aparece embaixo dele.
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Endereço já selecionado (pela busca ou pelo GPS) — os campos ficam
  // editáveis depois de escolhido, principalmente número e complemento.
  const [selected, setSelected] = useState(false);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ponto usado pra ordenar/priorizar a busca por distância. Começa no
  // centro fixo da cidade e é refinado pra localização real da pessoa
  // assim que o GPS responder (sem pedir permissão de novo se ela já foi
  // concedida antes em outra tela do app).
  const [searchOrigin, setSearchOrigin] = useState<SearchBias>(REGION_BIAS);

  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then((pos) => {
        if (pos) {
          setSearchOrigin({ ...REGION_BIAS, lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      })
      .catch(() => {
        // sem permissão ainda ou sem posição em cache — mantém o centro da cidade
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAddresses();
      setAddresses(data);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar seus endereços.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Busca com debounce: espera a pessoa parar de digitar por
  // SEARCH_DEBOUNCE_MS antes de bater na API, e cancela a busca anterior
  // se uma nova letra for digitada antes da resposta chegar.
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
        if (err?.name !== 'AbortError') {
          setSearchError('Não foi possível buscar. Tente de novo.');
        }
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchText, selected, searchOrigin]);

  function resetForm() {
    setLabel('Casa');
    setSearchText('');
    setSuggestions([]);
    setSelected(false);
    setStreet('');
    setNumber('');
    setComplement('');
    setNeighborhood('');
    setCity('');
    setState('');
    setZip('');
    setCoords(null);
  }

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

  // Preenche com a localização atual do GPS — alternativa a digitar e
  // buscar, útil quando a pessoa já está no endereço que quer salvar.
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

  async function handleSave() {
    if (street.trim().length < 2 || city.trim().length < 2 || state.trim().length < 2) {
      Alert.alert('Faltam dados', 'Busque o endereço acima ou preencha ao menos rua, cidade e estado.');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateAddressPayload = {
        label,
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
      await createAddress(payload);
      resetForm();
      setShowForm(false);
      await load();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o endereço.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    Alert.alert('Remover endereço', 'Tem certeza que deseja remover este endereço?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          try {
            await deleteAddress(id);
            setAddresses((prev) => prev.filter((a) => a.id !== id));
          } catch {
            Alert.alert('Erro', 'Não foi possível remover o endereço.');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Endereços</Text>
        {!showForm && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.addBtnText}>Novo</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4 }} keyboardShouldPersistTaps="handled">
        {showForm && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.formCard}>
              <Text style={styles.formLabel}>Tipo</Text>
              <View style={styles.chipsRow}>
                {LABELS.map((l) => (
                  <TouchableOpacity
                    key={l}
                    style={[styles.chip, label === l && styles.chipActive]}
                    onPress={() => setLabel(l)}
                  >
                    <Text style={[styles.chipText, label === l && styles.chipTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>

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
              {!selected && !searching && searchError && (
                <Text style={styles.searchErrorText}>{searchError}</Text>
              )}
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
                  <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="Nome da rua" />

                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Número</Text>
                      <TextInput style={styles.input} value={number} onChangeText={setNumber} placeholder="123" keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Complemento</Text>
                      <TextInput style={styles.input} value={complement} onChangeText={setComplement} placeholder="Apto, bloco..." />
                    </View>
                  </View>

                  <Text style={styles.formLabel}>Bairro</Text>
                  <TextInput style={styles.input} value={neighborhood} onChangeText={setNeighborhood} placeholder="Bairro" />

                  <View style={styles.row2}>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.formLabel}>Cidade</Text>
                      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Cidade" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>Estado</Text>
                      <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="UF" maxLength={2} autoCapitalize="characters" />
                    </View>
                  </View>

                  <Text style={styles.formLabel}>CEP</Text>
                  <TextInput style={styles.input} value={zip} onChangeText={setZip} placeholder="00000-000" keyboardType="number-pad" />
                </>
              )}

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (saving || !selected) && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={saving || !selected}
                >
                  {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Salvar endereço</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        {loading ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : addresses.length === 0 && !showForm ? (
          <View style={styles.emptyBox}>
            <Ionicons name="location-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>Nenhum endereço salvo</Text>
            <Text style={styles.emptySub}>Adicione seu endereço de casa, trabalho ou outro lugar</Text>
          </View>
        ) : (
          addresses.map((a) => (
            <View key={a.id} style={styles.addressCard}>
              <View style={styles.addressIcon}>
                <Ionicons name={labelIcon(a.label) as any} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressLabel}>{a.label || 'Endereço'}</Text>
                <Text style={styles.addressText}>{addressLine(a)}</Text>
                {a.lat != null && a.lng != null && <Text style={styles.gpsTag}>GPS salvo</Text>}
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(a.id)}
                disabled={deletingId === a.id}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {deletingId === a.id ? (
                  <ActivityIndicator color={colors.danger} size="small" />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 4,
  },
  title: { ...typography.h1, color: colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  addBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },

  formCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  formLabel: { color: colors.textMuted, fontSize: 12.5, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  chipTextActive: { color: colors.white },

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

  emptyBox: {
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 16, padding: 30,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { ...typography.bodyBold, color: colors.text, marginTop: 4 },
  emptySub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },

  addressCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  addressIcon: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  addressLabel: { ...typography.bodyBold, color: colors.text, fontSize: 14 },
  addressText: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  gpsTag: { color: colors.secondary, fontSize: 10.5, fontWeight: '700', marginTop: 4 },
});