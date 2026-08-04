import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useCart } from '../../context/CartContext';
import { Address, createAddress, listAddresses } from '../../services/addressService';
import { createOrder } from '../../services/orderService';
import { getRestaurantById } from '../../services/restaurantService';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

function addressLabel(a: Address) {
  const line = [a.street, a.number].filter(Boolean).join(', ');
  const rest = [a.neighborhood, a.city].filter(Boolean).join(' - ');
  return [line, rest].filter(Boolean).join(' · ') || 'Endereço';
}

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { items, addItem, decreaseItem, subtotal, clear, restaurantId } = useCart();
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [loadingFee, setLoadingFee] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);

  const loadAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const data = await listAddresses();
      setAddresses(data);
      if (data.length > 0) {
        setSelectedAddressId((prev) => prev ?? data[0].id);
      }
    } catch {
      // silencioso — usuário ainda pode capturar a localização atual
    } finally {
      setLoadingAddresses(false);
    }
  }, []);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  useEffect(() => {
    let active = true;
    if (!restaurantId) {
      setDeliveryFee(0);
      return;
    }
    setLoadingFee(true);
    getRestaurantById(restaurantId)
      .then((restaurant) => {
        if (active) setDeliveryFee(restaurant?.deliveryFee ?? 0);
      })
      .catch(() => {
        if (active) setDeliveryFee(0);
      })
      .finally(() => {
        if (active) setLoadingFee(false);
      });
    return () => {
      active = false;
    };
  }, [restaurantId]);

  const total = subtotal + deliveryFee;
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;

  async function handleUseCurrentLocation() {
    setCapturingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos da sua localização para entregar o pedido no lugar certo.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      if (!place) {
        Alert.alert('Não encontramos seu endereço', 'Tente novamente ou cadastre o endereço manualmente.');
        return;
      }
      const created = await createAddress({
        street: place.street || place.name || 'Endereço sem nome',
        number: place.streetNumber || undefined,
        neighborhood: place.district || place.subregion || undefined,
        city: place.city || place.subregion || 'Não informado',
        state: place.region || 'PE',
        zip: place.postalCode || undefined,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      setAddresses((prev) => [created, ...prev]);
      setSelectedAddressId(created.id);
      setPickerVisible(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível obter sua localização agora.');
    } finally {
      setCapturingLocation(false);
    }
  }

  async function handleCheckout() {
    if (!restaurantId) return;
    if (!selectedAddressId) {
      Alert.alert('Endereço de entrega', 'Escolha ou cadastre um endereço para receber o pedido.');
      setPickerVisible(true);
      return;
    }
    setSubmitting(true);
    try {
      await createOrder({
        restaurantId,
        addressId: selectedAddressId,
        items: items.map((ci) => ({ menuItemId: ci.item.id, qty: ci.qty })),
      });
      clear();
      Alert.alert('Pedido enviado!', 'Seu pedido foi enviado ao restaurante.');
      navigation.navigate('Orders');
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Não foi possível enviar o pedido. Tente novamente.';
      Alert.alert('Erro ao finalizar pedido', message);
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyWrap}>
          <Ionicons name="cart-outline" size={54} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Seu carrinho está vazio</Text>
          <Text style={styles.emptySub}>Adicione itens de um restaurante para começar</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Seu carrinho</Text>
      <FlatList
        data={items}
        keyExtractor={(ci) => ci.item.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addressCard} onPress={() => setPickerVisible(true)}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>Entregar em</Text>
              {loadingAddresses ? (
                <Text style={styles.addressValue}>Carregando endereços...</Text>
              ) : selectedAddress ? (
                <Text style={styles.addressValue}>{addressLabel(selectedAddress)}</Text>
              ) : (
                <Text style={styles.addressMissing}>Nenhum endereço escolhido — toque para adicionar</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        }
        renderItem={({ item: ci }) => (
          <View style={styles.row}>
            <Image source={{ uri: ci.item.image }} style={styles.image} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{ci.item.name}</Text>
              <Text style={styles.price}>R$ {ci.item.price.toFixed(2)}</Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity onPress={() => decreaseItem(ci.item.id)} style={styles.qtyBtn}>
                <Ionicons name="remove" size={16} color={colors.secondary} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{ci.qty}</Text>
              <TouchableOpacity onPress={() => addItem(ci.item)} style={styles.qtyBtn}>
                <Ionicons name="add" size={16} color={colors.secondary} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>R$ {subtotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Taxa de entrega</Text>
          {loadingFee ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Text style={styles.summaryValue}>R$ {deliveryFee.toFixed(2)}</Text>
          )}
        </View>
        <View style={[styles.summaryRow, { marginTop: 4 }]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
        </View>
        <Button
          label="Finalizar pedido"
          onPress={handleCheckout}
          loading={submitting}
          disabled={loadingFee}
          style={{ marginTop: 16 }}
        />
      </View>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Endereço de entrega</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={styles.addressOption}
                onPress={() => {
                  setSelectedAddressId(addr.id);
                  setPickerVisible(false);
                }}
              >
                <Ionicons
                  name={selectedAddressId === addr.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedAddressId === addr.id ? colors.primary : colors.textMuted}
                />
                <Text style={styles.addressOptionText}>{addressLabel(addr)}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.gpsBtn, capturingLocation && { opacity: 0.6 }]}
              onPress={handleUseCurrentLocation}
              disabled={capturingLocation}
            >
              {capturingLocation ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                  <Text style={styles.gpsBtnText}>Usar minha localização atual</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text, paddingHorizontal: 20, marginBottom: 14 },
  addressCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  addressLabel: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  addressValue: { color: colors.text, fontSize: 13.5, marginTop: 2, fontWeight: '600' },
  addressMissing: { color: colors.danger, fontSize: 13, marginTop: 2, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  image: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.border },
  name: { ...typography.bodyBold, color: colors.text },
  price: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.secondaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { fontWeight: '700', color: colors.text, minWidth: 16, textAlign: 'center' },
  summary: {
    padding: 20, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { color: colors.textMuted, fontSize: 14 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  totalLabel: { ...typography.bodyBold, color: colors.text },
  totalValue: { ...typography.h2, color: colors.primary },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  emptyTitle: { ...typography.h2, color: colors.text, marginTop: 8 },
  emptySub: { color: colors.textMuted, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { ...typography.h2, color: colors.text },
  addressOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  addressOptionText: { color: colors.text, fontSize: 14, flex: 1 },
  gpsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingVertical: 14, marginTop: 10,
  },
  gpsBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
