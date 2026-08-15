import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { useTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../theme/colors';
import { typography } from '../theme/typography';
import { Addon, MenuItem } from '../types';

interface Props {
  visible: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (selectedAddons: Addon[], qty: number, notes: string) => void;
}

// Modal que o cliente vê ao tocar em "+" num item que tem adicionais
// cadastrados pelo restaurante (ex: bacon extra, borda recheada). O preço
// total já mostra o valor somado antes de confirmar.
export function AddonsModal({ visible, item, onClose, onConfirm }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set());
      setQty(1);
      setNotes('');
    }
  }, [visible, item?.id]);

  if (!item) return null;

  const addons = item.addons || [];

  function toggle(addonId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(addonId)) next.delete(addonId);
      else next.add(addonId);
      return next;
    });
  }

  const selectedAddons = addons.filter((a) => selectedIds.has(a.id));
  const unitPrice = item.price + selectedAddons.reduce((s, a) => s + a.price, 0);
  const total = unitPrice * qty;

  function handleConfirm() {
    onConfirm(selectedAddons, qty, notes.trim());
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.card} edges={['bottom']}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.subtitle}>
                {addons.length > 0 ? 'Escolha os adicionais' : 'Confirme os detalhes do item'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
            {addons.map((addon) => {
              const checked = selectedIds.has(addon.id);
              return (
                <TouchableOpacity key={addon.id} style={styles.addonRow} onPress={() => toggle(addon.id)}>
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={checked ? colors.primary : colors.textMuted}
                  />
                  <Text style={styles.addonName}>{addon.name}</Text>
                  <Text style={styles.addonPrice}>+ R$ {addon.price.toFixed(2)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.notesBlock}>
            <Text style={styles.qtyLabel}>Observação (opcional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Ex: sem cebola, ponto da carne bem passado..."
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={300}
            />
          </View>

          <View style={styles.qtyBlock}>
            <Text style={styles.qtyLabel}>Quantidade</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQty((q) => Math.max(1, q - 1))}
              >
                <Ionicons name="remove" size={18} color={colors.secondary} />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{qty}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setQty((q) => q + 1)}>
                <Ionicons name="add" size={18} color={colors.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <Button label={`Adicionar · R$ ${total.toFixed(2)}`} onPress={handleConfirm} style={{ marginTop: 16 }} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  card: {
    backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  title: { ...typography.h2, color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  addonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  addonName: { flex: 1, color: colors.text, fontSize: 14.5, fontWeight: '600' },
  addonPrice: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  notesBlock: { marginTop: 16 },
  notesInput: {
    marginTop: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, fontSize: 13.5, color: colors.text, minHeight: 60, textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  qtyBlock: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16,
  },
  qtyLabel: { ...typography.bodyBold, color: colors.text },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.secondaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyValue: { fontWeight: '700', color: colors.text, minWidth: 18, textAlign: 'center', fontSize: 15 },
});
};
