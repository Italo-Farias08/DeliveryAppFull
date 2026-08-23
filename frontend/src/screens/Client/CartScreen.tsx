import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { FadeSlideIn } from '../../components/FadeSlideIn';
import { PressableScale } from '../../components/PressableScale';
import { PixPaymentModal } from '../../components/PixPaymentModal';
import { useCart } from '../../context/CartContext';
import { createAddress, listAddresses } from '../../services/addressService';
import type { Address } from '../../services/addressService';
import { createOrder, payOrderPix, PaymentMethod, PixPayment } from '../../services/orderService';
import { getRestaurantById } from '../../services/restaurantService';
import { useTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { distanceMeters } from '../../utils/geo';

// Distância máxima (em metros) entre o GPS atual e o endereço principal
// pra considerar que a pessoa "está" no endereço cadastrado.
const MAX_ADDRESS_DISTANCE_M = 200;

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'pix_app', label: 'Pix no app', icon: 'qr-code-outline' },
  { value: 'pix_entrega', label: 'Pix na entrega', icon: 'flash-outline' },
  { value: 'dinheiro', label: 'Dinheiro', icon: 'cash-outline' },
  { value: 'cartao_credito', label: 'Cartão de crédito', icon: 'card-outline' },
  { value: 'cartao_debito', label: 'Cartão de débito', icon: 'card-outline' },
];

const PAYMENT_LABELS: Record<Exclude<PaymentMethod, 'pix_app'>, string> = {
  pix_entrega: 'Pix',
  dinheiro: 'dinheiro',
  cartao_credito: 'cartão de crédito',
  cartao_debito: 'cartão de débito',
};

function addressLabel(a: Address) {
  const line = [a.street, a.number].filter(Boolean).join(', ');
  const rest = [a.neighborhood, a.city].filter(Boolean).join(' - ');
  return [line, rest].filter(Boolean).join(' · ') || 'Endereço';
}

export default function CartScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { items, increaseItem, decreaseItem, updateItemNotes, subtotal, clear, restaurantId } = useCart();
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [minOrderValue, setMinOrderValue] = useState(0);
  const [loadingFee, setLoadingFee] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null);
  const [pixModalVisible, setPixModalVisible] = useState(false);
  const [pixOrderId, setPixOrderId] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix_app');
  const [changeForText, setChangeForText] = useState('');

  const loadAddresses = useCallback(async () => {
    setLoadingAddresses(true);
    try {
      const data = await listAddresses();
      setAddresses(data);
      if (data.length > 0) {
        const defaultAddress = data.find((a) => a.isDefault);
        setSelectedAddressId((prev) => prev ?? defaultAddress?.id ?? data[0].id);
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
      setMinOrderValue(0);
      return;
    }
    setLoadingFee(true);
    getRestaurantById(restaurantId)
      .then((restaurant) => {
        if (active) {
          setDeliveryFee(restaurant?.deliveryFee ?? 0);
          setMinOrderValue(restaurant?.minOrderValue ?? 0);
        }
      })
      .catch(() => {
        if (active) {
          setDeliveryFee(0);
          setMinOrderValue(0);
        }
      })
      .finally(() => {
        if (active) setLoadingFee(false);
      });
    return () => {
      active = false;
    };
  }, [restaurantId]);

  const total = subtotal + deliveryFee;
  const belowMinimum = minOrderValue > 0 && subtotal < minOrderValue;
  const missingForMinimum = Math.max(0, minOrderValue - subtotal);
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;
  const changeForValue = changeForText.trim() ? Number(changeForText.replace(',', '.')) : undefined;

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

  // Confere se a localização atual (GPS) bate com o endereço principal
  // fixado. Se a pessoa estiver longe do endereço, avisa e deixa ela
  // decidir se quer confirmar mesmo assim ou trocar o endereço.
  async function confirmMatchesCurrentLocation(address: Address): Promise<boolean> {
    if (address.lat == null || address.lng == null) return true; // sem GPS salvo, não dá pra conferir

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return true; // sem permissão, segue sem bloquear o pedido

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const distance = distanceMeters(
        position.coords.latitude,
        position.coords.longitude,
        address.lat,
        address.lng
      );

      if (distance <= MAX_ADDRESS_DISTANCE_M) return true;

      return await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Você está longe do seu endereço principal',
          `Sua localização atual está a ${(distance / 1000).toFixed(1)} km do endereço "${addressLabel(address)}". Confirma que quer entregar aí mesmo assim?`,
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Confirmar mesmo assim', onPress: () => resolve(true) },
          ]
        );
      });
    } catch {
      return true; // não conseguiu obter GPS agora — não bloqueia o pedido por isso
    }
  }

  async function handleCheckout() {
    if (!restaurantId) return;
    if (belowMinimum) {
      Alert.alert(
        'Pedido mínimo não atingido',
        `Este restaurante exige um pedido mínimo de R$ ${minOrderValue.toFixed(2)}. Faltam R$ ${missingForMinimum.toFixed(2)} para continuar.`
      );
      return;
    }
    if (!selectedAddressId) {
      Alert.alert('Endereço de entrega', 'Escolha ou cadastre um endereço para receber o pedido.');
      setPickerVisible(true);
      return;
    }
    if (paymentMethod === 'dinheiro' && changeForValue != null && changeForValue < total) {
      Alert.alert(
        'Troco inválido',
        `O valor para troco deve ser maior ou igual ao total do pedido (R$ ${total.toFixed(2)}).`
      );
      return;
    }
    if (selectedAddress) {
      const ok = await confirmMatchesCurrentLocation(selectedAddress);
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      const order = await createOrder({
        restaurantId,
        addressId: selectedAddressId,
        paymentMethod,
        changeFor: paymentMethod === 'dinheiro' ? changeForValue : undefined,
        items: items.map((ci) => ({
          menuItemId: ci.item.id,
          qty: ci.qty,
          addonIds: ci.selectedAddons.map((a) => a.id),
          notes: ci.notes?.trim() || undefined,
        })),
      });
      clear();

      if (paymentMethod !== 'pix_app') {
        // Pagamento na ENTREGA (dinheiro, cartão ou Pix com o entregador) --
        // não tem nada pra pagar agora dentro do app, o restaurante já foi
        // avisado e vai começar a preparar o pedido.
        navigation.navigate('Orders');
        Alert.alert(
          'Pedido enviado!',
          `Seu pedido foi enviado ao restaurante. Pague em ${PAYMENT_LABELS[paymentMethod]} na entrega.` +
            (paymentMethod === 'dinheiro' && changeForValue
              ? ` Troco para R$ ${changeForValue.toFixed(2)}.`
              : '')
        );
        return;
      }

      // Pedido criado, mas ainda não pago -- gera o Pix direto (QR code +
      // copia-e-cola) dentro do próprio app. O restaurante só vê o pedido
      // depois que o pagamento for confirmado (webhook -> evento em tempo
      // real via socket), que é o que fecha esse modal sozinho.
      setPixOrderId(order.id);
      setPixModalVisible(true);
      try {
        const payment = await payOrderPix(order.id);
        setPixPayment(payment);
      } catch (payErr: any) {
        // O pedido já existe mesmo se a geração do Pix falhar agora --
        // a tela de pedidos tem um botão "Pagar agora" pra tentar de novo.
        setPixModalVisible(false);
        navigation.navigate('Orders');
        const message = payErr?.response?.data?.error || 'Não foi possível gerar o Pix agora.';
        Alert.alert(
          'Pedido criado',
          `${message} Vá em "Meus pedidos" e toque em "Pagar agora" para tentar de novo.`
        );
      }
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
        <FadeSlideIn style={styles.emptyWrap}>
          <Ionicons name="cart-outline" size={54} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Seu carrinho está vazio</Text>
          <Text style={styles.emptySub}>Adicione itens de um restaurante para começar</Text>
        </FadeSlideIn>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Text style={styles.title}>Seu carrinho</Text>
      <FlatList
        data={items}
        keyExtractor={(ci) => ci.key}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        ListHeaderComponent={
          <PressableScale style={styles.addressCard} onPress={() => setPickerVisible(true)} scaleTo={0.98}>
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
          </PressableScale>
        }
        renderItem={({ item: ci, index }) => {
          const unitPrice = (ci.item.promoPrice ?? ci.item.price) + ci.selectedAddons.reduce((s, a) => s + a.price, 0);
          return (
            <FadeSlideIn index={index} style={styles.cartItemCard}>
              <View style={styles.row}>
                <Image source={{ uri: ci.item.image }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name}>{ci.item.name}</Text>
                  {ci.selectedAddons.length > 0 && (
                    <Text style={styles.addonsText}>
                      + {ci.selectedAddons.map((a) => a.name).join(', ')}
                    </Text>
                  )}
                  <Text style={styles.price}>R$ {unitPrice.toFixed(2)}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <PressableScale onPress={() => decreaseItem(ci.key)} style={styles.qtyBtn} scaleTo={0.82}>
                    <Ionicons name="remove" size={16} color={colors.secondary} />
                  </PressableScale>
                  <Text style={styles.qtyText}>{ci.qty}</Text>
                  <PressableScale onPress={() => increaseItem(ci.key)} style={styles.qtyBtn} scaleTo={0.82}>
                    <Ionicons name="add" size={16} color={colors.secondary} />
                  </PressableScale>
                </View>
              </View>

              {/* campo de observação, separado visualmente do item e dos
                  adicionais por uma linha divisória */}
              <View style={styles.notesRow}>
                <Ionicons name="create-outline" size={15} color={colors.textMuted} />
                <TextInput
                  style={styles.notesInput}
                  placeholder="Adicionar observação (ex: sem cebola)"
                  placeholderTextColor={colors.textMuted}
                  value={ci.notes}
                  onChangeText={(text) => updateItemNotes(ci.key, text)}
                  multiline
                  maxLength={300}
                />
              </View>
            </FadeSlideIn>
          );
        }}
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
        {belowMinimum && (
          <View style={styles.minOrderWarning}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.minOrderWarningText}>
              Pedido mínimo deste restaurante: R$ {minOrderValue.toFixed(2)}. Faltam R$ {missingForMinimum.toFixed(2)}.
            </Text>
          </View>
        )}

        <Text style={styles.paymentTitle}>Forma de pagamento</Text>
        <View style={styles.paymentOptions}>
          {PAYMENT_OPTIONS.map((opt) => {
            const selected = paymentMethod === opt.value;
            return (
              <PressableScale
                key={opt.value}
                style={[styles.paymentOption, selected && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod(opt.value)}
                scaleTo={0.96}
              >
                <Ionicons name={opt.icon} size={16} color={selected ? colors.primary : colors.textMuted} />
                <Text style={[styles.paymentOptionText, selected && styles.paymentOptionTextSelected]}>
                  {opt.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        {paymentMethod === 'dinheiro' && (
          <View style={styles.changeForRow}>
            <Ionicons name="cash-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.changeForInput}
              placeholder="Precisa de troco para quanto? (opcional)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={changeForText}
              onChangeText={setChangeForText}
            />
          </View>
        )}

        <Button
          label="Ir para pagamento"
          onPress={handleCheckout}
          loading={submitting}
          disabled={loadingFee || belowMinimum}
          style={{ marginTop: 16 }}
        />
      </View>

      <Modal visible={pickerVisible} animationType="slide" transparent onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Endereço de entrega</Text>
              <PressableScale onPress={() => setPickerVisible(false)} hitSlop={10} scaleTo={0.85}>
                <Ionicons name="close" size={22} color={colors.text} />
              </PressableScale>
            </View>

            {addresses.map((addr) => (
              <PressableScale
                key={addr.id}
                style={styles.addressOption}
                onPress={() => {
                  setSelectedAddressId(addr.id);
                  setPickerVisible(false);
                }}
                scaleTo={0.98}
              >
                <Ionicons
                  name={selectedAddressId === addr.id ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selectedAddressId === addr.id ? colors.primary : colors.textMuted}
                />
                <Text style={styles.addressOptionText}>{addressLabel(addr)}</Text>
              </PressableScale>
            ))}

            <PressableScale
              style={[styles.gpsBtn, capturingLocation && { opacity: 0.6 }]}
              onPress={handleUseCurrentLocation}
              disabled={capturingLocation}
              scaleTo={0.97}
            >
              {capturingLocation ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="navigate-outline" size={18} color={colors.primary} />
                  <Text style={styles.gpsBtnText}>Usar minha localização atual</Text>
                </>
              )}
            </PressableScale>
          </View>
        </View>
      </Modal>

      <PixPaymentModal
        visible={pixModalVisible}
        orderId={pixOrderId ?? ''}
        payment={pixPayment}
        onClose={() => {
          setPixModalVisible(false);
          setPixPayment(null);
          navigation.navigate('Orders');
        }}
        onPaid={() => {
          setPixModalVisible(false);
          setPixPayment(null);
          navigation.navigate('Orders');
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text, paddingHorizontal: 20, marginBottom: 14 },
  addressCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 16,
    ...shadows.sm,
  },
  addressLabel: { color: colors.textMuted, fontSize: 11.5, fontWeight: '700' },
  addressValue: { color: colors.text, fontSize: 13.5, marginTop: 2, fontWeight: '600' },
  addressMissing: { color: colors.danger, fontSize: 13, marginTop: 2, fontWeight: '600' },
  cartItemCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 12, marginBottom: 14,
    ...shadows.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  image: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.border },
  name: { ...typography.bodyBold, color: colors.text },
  addonsText: { color: colors.secondary, fontSize: 11.5, marginTop: 2, fontWeight: '600' },
  price: { color: colors.textMuted, marginTop: 2, fontSize: 13 },
  notesRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  notesInput: { flex: 1, fontSize: 12.5, color: colors.text, padding: 0, minHeight: 18 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.secondaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyText: { fontWeight: '700', color: colors.text, minWidth: 16, textAlign: 'center' },
  summary: {
    padding: 20, paddingBottom: 28,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    ...shadows.lg,
    shadowOffset: { width: 0, height: -8 },
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { color: colors.textMuted, fontSize: 14 },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  totalLabel: { ...typography.bodyBold, color: colors.text },
  totalValue: { ...typography.h2, color: colors.primary },
  minOrderWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.dangerLight, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, marginTop: 8,
  },
  minOrderWarningText: { color: colors.danger, fontSize: 12, flex: 1, fontWeight: '600' },
  paymentTitle: { ...typography.bodyBold, color: colors.text, marginTop: 14, marginBottom: 8 },
  paymentOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentOption: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  paymentOptionSelected: { borderColor: colors.primary, backgroundColor: colors.secondaryLight },
  paymentOptionText: { color: colors.textMuted, fontSize: 12.5, fontWeight: '600' },
  paymentOptionTextSelected: { color: colors.primary },
  changeForRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 10,
  },
  changeForInput: { flex: 1, fontSize: 13.5, color: colors.text, padding: 0 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  emptyTitle: { ...typography.h2, color: colors.text, marginTop: 8 },
  emptySub: { color: colors.textMuted, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, ...shadows.lg },
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
};