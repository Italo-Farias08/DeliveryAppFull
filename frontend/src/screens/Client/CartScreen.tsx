import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { useCart } from '../../context/CartContext';
import { useOrders } from '../../context/OrderContext';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { items, addItem, decreaseItem, subtotal, clear } = useCart();
  const { addOrder } = useOrders();

  const deliveryFee = items.length > 0 ? 6.9 : 0;
  const total = subtotal + deliveryFee;

  function handleCheckout() {
    Alert.alert(
      'Modo demonstração',
      'Esse app ainda não tem backend conectado, então o pedido não será enviado de verdade — mas vamos simular a confirmação para você ver o fluxo completo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Simular pedido',
          onPress: () => {
            addOrder({
              id: 'o-' + Date.now(),
              restaurantName: items[0]?.item.restaurantId ?? 'Restaurante',
              items,
              total,
              status: 'preparando',
              createdAt: new Date().toISOString(),
            });
            clear();
            navigation.navigate('Orders');
          },
        },
      ]
    );
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
          <Text style={styles.summaryValue}>R$ {deliveryFee.toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryRow, { marginTop: 4 }]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>R$ {total.toFixed(2)}</Text>
        </View>
        <Button label="Finalizar pedido" onPress={handleCheckout} style={{ marginTop: 16 }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h1, color: colors.text, paddingHorizontal: 20, marginBottom: 14 },
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
});
